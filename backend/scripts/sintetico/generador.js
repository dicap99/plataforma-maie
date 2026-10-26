// Generador de una base de datos sintética del Módulo 2 (promociones, docentes, estudiantes,
// ofertas de curso, matrículas y calificaciones de rúbrica). Es una función pura: no toca la BD
// y devuelve claves lógicas (código del curso, correo, código de RA + orden del criterio) que
// resuelve el cargador. Con la misma semilla devuelve exactamente los mismos datos.
const { crearPrng } = require('./prng');
const { NOMBRES, APELLIDOS, TEMAS } = require('./nombres');

const DOMINIO = 'sintetico.maie.local';
const PREFIJO_COHORTE = 'Sintética';

// Estructura del catálogo sembrada en database/seed.sql (Tablas 3 y 4 del documento RA MaIE).
const CATALOGO = [
  { codigo: 'MaIE-CB1', semestre: 1, ras: ['RA1'] },
  { codigo: 'MaIE-CB2', semestre: 1, ras: ['RA1'] },
  { codigo: 'MaIE-CP1', semestre: 1, ras: ['RA3'] },
  { codigo: 'MaIE-CP2', semestre: 2, ras: ['RA4'] },
  { codigo: 'MaIE-CP3', semestre: 2, ras: ['RA4'] },
  { codigo: 'MaIE-CE1', semestre: 2, ras: ['RA2'] },
  { codigo: 'MaIE-CE2', semestre: 3, ras: ['RA2'] },
  { codigo: 'MaIE-CI1', semestre: 3, ras: ['RA3', 'RA5'] },
  { codigo: 'MaIE-Tesis-I', semestre: 3, ras: ['RA5'] },
  { codigo: 'MaIE-CI2', semestre: 4, ras: ['RA5', 'RA6', 'RA7'] },
  { codigo: 'MaIE-Tesis-II', semestre: 4, ras: ['RA5', 'RA6', 'RA7'] },
];
// Clase de los cursos del plan que tienen una sola (las demás se eligen de TEMAS), como en seed.sql.
const CLASE_UNICA = {
  'MaIE-CB1': 'Sistemas Lineales de Múltiples Variables',
  'MaIE-CB2': 'Optimización',
  'MaIE-CP1': 'Introducción a la Profundización',
  'MaIE-CI1': 'Formulación de Proyectos de Investigación',
  'MaIE-Tesis-I': 'Tesis I',
  'MaIE-CI2': 'Redacción de Artículos Científicos',
  'MaIE-Tesis-II': 'Tesis II',
};
const CRITERIOS_POR_RA = 4;
// Dificultad relativa de cada RA: hace que algunos RA queden por debajo de la meta del programa,
// como el caso que motivó los reportes («no salen altos… ¿por qué?»).
const DIFICULTAD = { RA1: -0.15, RA4: -0.45, RA6: -0.2 };

// Periodos académicos como índice entero (2025-A → 4050, 2025-B → 4051) para poder sumarlos.
const aIndice = (periodo) => Number(periodo.slice(0, 4)) * 2 + (periodo.endsWith('B') ? 1 : 0);
const aPeriodo = (i) => `${Math.floor(i / 2)}-${i % 2 ? 'B' : 'A'}`;

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const limitar = (x, min, max) => Math.min(max, Math.max(min, x));
const redondear2 = (x) => Math.round(x * 100) / 100;
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Hojas del Módulo 1 de las promociones sintéticas (avance de estudiantes, cursos y docentes por
// semestre, perfiles docentes, beneficios, producción y pasantías), coherentes con las ofertas y
// matrículas generadas. Se calcula al final para no alterar los datos del Módulo 2 de cada semilla.
const LINEAS = ['Automatización y Control', 'Sistemas de Comunicaciones', 'Energía Eléctrica',
  'Procesamiento de Señales', 'Robótica', 'Machine Learning'];
const TITULOS = ['Doctorado en Ingeniería', 'Doctorado en Ingeniería Electrónica', 'Doctorado en Ciencias de la Computación',
  'Maestría en Ingeniería Electrónica'];
const PRODUCTOS = { articulos: 'Artículo', ponencias: 'Ponencia', software: 'Registro de software', prototipos: 'Prototipo' };

const generarModulo1 = (azar, { cohortes, docentes, estudiantes, cursos, actual }) => {
  const semestreDe = new Map(CATALOGO.map((k) => [k.codigo, k.semestre]));
  const perfiles = docentes.map((d) => ({
    email: d.email,
    nombre_completo: `${d.nombres} ${d.apellidos}`,
    afiliacion: azar.probabilidad(0.6) ? 'UDENAR' : 'EXTERNO',
    formacion_profesional: azar.elegir(TITULOS),
    campo_formacion: azar.barajar(LINEAS).slice(0, azar.probabilidad(0.3) ? 2 : 1).join(', '),
  }));
  const afiliacion = new Map(perfiles.map((p) => [p.email, p.afiliacion]));
  const semestres = [];
  const beneficios = [];
  const produccion = [];
  const pasantias = [];

  for (const h of cohortes) {
    const inicio = aIndice(h.periodo_inicio);
    const propios = estudiantes.filter((e) => e.cohorte === h.nombre);
    const n = propios.length;
    const activos = n - propios.filter((e) => e.estado === 'retirado').length;
    const cerrado = (s) => inicio + s - 1 < actual; // el semestre s de la promoción ya terminó
    const terminado = cerrado(4);

    h.inscritos = n + azar.entero(1, 4);
    h.aprobados_sem1 = cerrado(1) ? n : null;
    h.aprobados_sem2 = cerrado(2) ? n : null;
    h.aprobados_sem3 = cerrado(3) ? activos : null;
    h.egresados = terminado ? activos : null;
    h.graduados = terminado ? Math.max(0, activos - azar.entero(0, 3)) : 0;
    // Estado de cada estudiante coherente con la promoción: al terminar, graduados y egresados.
    if (terminado) {
      propios.filter((e) => e.estado !== 'retirado').forEach((e, i) => { e.estado = i < h.graduados ? 'graduado' : 'egresado'; });
    }

    for (let s = 1; s <= 4; s += 1) {
      const ofertas = cursos.filter((c) => c.cohorte === h.nombre && semestreDe.get(c.catalogo) === s);
      if (!ofertas.length) continue;
      const equipo = [...new Set(ofertas.flatMap((c) => c.docentes))];
      semestres.push({
        cohorte: h.nombre,
        semestre: s,
        n_cursos: ofertas.length,
        docentes_udenar: equipo.filter((e) => afiliacion.get(e) === 'UDENAR').length,
        docentes_externos: equipo.filter((e) => afiliacion.get(e) === 'EXTERNO').length,
      });
    }

    // Becas por estudiante (Gestión académica › Usuarios); la hoja de beneficios cuenta lo mismo.
    const cupos = { 100: azar.entero(0, 2), hora_catedra: azar.entero(0, 2), sintraunicol: azar.entero(0, 1) };
    const candidatos = azar.barajar(propios);
    for (const [beca, n] of Object.entries(cupos)) {
      for (const e of candidatos.splice(0, n)) e.beca = beca;
    }
    const contar = (beca) => propios.filter((e) => e.beca === beca).length;
    beneficios.push({
      cohorte: h.nombre,
      becas_100: contar('100'),
      becas_hora_catedra: contar('hora_catedra'),
      becas_sintraunicol: contar('sintraunicol'),
      asistentes_investigacion: azar.entero(0, 4),
      ayudantes_docencia: azar.entero(0, 3),
    });

    const investiga = cerrado(2); // la producción y las pasantías llegan desde el semestre III
    const p = {
      cohorte: h.nombre,
      articulos: investiga ? azar.entero(0, 5) : 0,
      ponencias: investiga ? azar.entero(1, 7) : 0,
      software: investiga ? azar.entero(0, 2) : 0,
      prototipos: investiga ? azar.entero(0, 3) : 0,
      tesis: h.graduados,
    };
    p.detalles = Object.entries(PRODUCTOS)
      .flatMap(([campo, tipo]) => Array.from({ length: p[campo] }, (_, i) => `- ${tipo} ${i + 1} (${azar.elegir(LINEAS)})`))
      .join('\n') || null;
    produccion.push(p);
    pasantias.push({
      cohorte: h.nombre,
      nacionales: investiga ? azar.entero(0, 3) : 0,
      internacionales: investiga ? azar.entero(0, 2) : 0,
    });
  }

  return { perfiles, semestres, beneficios, produccion, pasantias, finanzas: generarFinanzas(azar, { cohortes, actual }) };
};

// Hojas financieras de las promociones sintéticas: punto de equilibrio, cortes de presupuesto (alguno
// con gastos por encima de los ingresos), estudiantes de pregrado y transferencias y contrataciones OPS
// por periodo. Valores en pesos con el SMMLV de la semilla (seed.sql: smmlv_2025).
const SMMLV = 1423500;
const finDeSemestre = (indice) => `${Math.floor(indice / 2)}-${indice % 2 ? '12-15' : '06-30'}`;
const redondearMiles = (x) => Math.round(x / 1000) * 1000;

const generarFinanzas = (azar, { cohortes, actual }) => {
  const puntoEquilibrio = [];
  const presupuesto = [];
  const pregrado = [];
  for (const h of cohortes) {
    const inicio = aIndice(h.periodo_inicio);
    const valorSmmlv = azar.elegir([4.5, 5, 5.5]);
    const proyectados = redondearMiles(h.matriculados * valorSmmlv * SMMLV * 4);
    puntoEquilibrio.push({ cohorte: h.nombre, estudiantes_equilibrio: azar.entero(6, 9), valor_matricula_smmlv: valorSmmlv, ingresos_proyectados: proyectados });

    const cerrados = Math.min(4, actual - inicio); // semestres de la promoción ya terminados
    for (let s = 1; s <= cerrados; s += 1) {
      if (s % 2 === 1 && s !== cerrados) continue; // un corte por año y el corte más reciente
      const ingresos = redondearMiles(proyectados * (s / 4) * (0.9 + azar.siguiente() * 0.1));
      const gastos = redondearMiles(ingresos * (0.55 + azar.siguiente() * 0.5));
      presupuesto.push({
        cohorte: h.nombre,
        fecha_corte: finDeSemestre(inicio + s - 1),
        ingresos,
        gastos_comprometidos: gastos,
        saldo_certificado: Math.max(0, redondearMiles((ingresos - gastos) * 0.95)),
      });
      const estudiantes = azar.entero(0, 5);
      pregrado.push({
        cohorte: h.nombre,
        periodo: aPeriodo(inicio + s - 1),
        estudiantes,
        inscripciones: estudiantes + azar.entero(0, 3),
        ingreso: redondearMiles(estudiantes * 0.5 * SMMLV),
      });
    }
  }

  // Transferencias a la Vicerrectoría Académica y contrataciones OPS por periodo académico.
  const transferencias = [];
  const contrataciones = [];
  const primero = Math.min(...cohortes.map((h) => aIndice(h.periodo_inicio)));
  for (let p = primero; p <= actual; p += 1) {
    const activas = cohortes.filter((h) => aIndice(h.periodo_inicio) <= p && p <= aIndice(h.periodo_inicio) + 3);
    if (!activas.length) continue;
    const promociones = `Sintética ${activas.map((h) => h.nombre.split(' ')[1]).join(', ')}`;
    const nDocentes = azar.entero(1, 4);
    const nOps = azar.entero(1, 4);
    transferencias.push({ periodo: aPeriodo(p), promociones, n_docentes: nDocentes, valor: nDocentes * azar.entero(6, 9) * 1000000 });
    contrataciones.push({ periodo: aPeriodo(p), promociones, n_ops: nOps, valor: nOps * azar.entero(5, 8) * 1000000 });
  }
  return { puntoEquilibrio, presupuesto, pregrado, transferencias, contrataciones };
};

const generar = ({
  semilla = 2026,
  nCohortes = 5,
  estudiantes: [minEst, maxEst] = [6, 14],
  nDocentes = 10,
  periodoBase = '2022-A',
  periodoActual = '2026-B',
  pRetiro = 0.05,
  pIncompleta = 0.02,
} = {}) => {
  const azar = crearPrng(semilla);
  const persona = (tipo, i) => {
    const nombres = azar.elegir(NOMBRES);
    const apellidos = `${azar.elegir(APELLIDOS)} ${azar.elegir(APELLIDOS)}`;
    const usuario = `${sinTildes(nombres)}.${sinTildes(apellidos.split(' ')[0])}`;
    return {
      identificacion: `SIN-${tipo}${String(i).padStart(4, '0')}`,
      nombres,
      apellidos,
      email: `${usuario}.${tipo.toLowerCase()}${i}@${DOMINIO}`,
    };
  };

  const docentes = Array.from({ length: nDocentes }, (_, i) => persona('D', i + 1));
  const actual = aIndice(periodoActual);

  const cohortes = [];
  const estudiantes = [];
  const cursos = [];
  const inscripciones = [];
  const calificaciones = [];
  let nEst = 0;

  for (let c = 0; c < nCohortes; c += 1) {
    const inicio = aIndice(periodoBase) + 2 * c; // una promoción nueva cada año, en el semestre A
    const nombre = `${PREFIJO_COHORTE} ${ROMANOS[c] ?? c + 1}`;
    const n = azar.entero(minEst, maxEst);

    // Habilidad latente de cada estudiante: produce niveles coherentes entre cursos y RA.
    const propios = Array.from({ length: n }, () => {
      nEst += 1;
      const e = { ...persona('E', nEst), cohorte: nombre, estado: 'matriculado', theta: azar.normal(), delta: {} };
      if (azar.probabilidad(pRetiro)) e.estado = 'retirado'; // se retira al terminar el semestre II
      return e;
    });
    cohortes.push({ nombre, periodo_inicio: aPeriodo(inicio), periodo_fin: aPeriodo(inicio + 3), inscritos: n, matriculados: n });

    for (const k of CATALOGO) {
      const periodo = inicio + k.semestre - 1;
      if (periodo > actual) continue; // la promoción aún no llega a ese semestre
      const clave = `${nombre}|${k.codigo}`;
      const equipo = azar.barajar(docentes).slice(0, azar.probabilidad(0.25) ? 2 : 1).map((d) => d.email);
      cursos.push({
        clave,
        catalogo: k.codigo,
        cohorte: nombre,
        periodo: aPeriodo(periodo),
        clase: TEMAS[k.codigo] ? azar.elegir(TEMAS[k.codigo]) : CLASE_UNICA[k.codigo],
        docentes: equipo,
      });

      const cursan = propios.filter((e) => e.estado !== 'retirado' || k.semestre <= 2);
      for (const e of cursan) {
        inscripciones.push({ curso: clave, estudiante: e.email });
        for (const ra of k.ras) {
          if (!(ra in e.delta)) e.delta[ra] = azar.normal();
          const incompleta = azar.probabilidad(pIncompleta);
          for (let orden = 1; orden <= CRITERIOS_POR_RA; orden += 1) {
            if (incompleta && orden === CRITERIOS_POR_RA) continue; // rúbrica sin terminar
            const nota = 3.75 + (DIFICULTAD[ra] ?? 0) + 0.55 * e.theta + 0.3 * e.delta[ra] + 0.08 * k.semestre + 0.3 * azar.normal();
            calificaciones.push({
              curso: clave,
              estudiante: e.email,
              ra,
              orden,
              calificacion: redondear2(limitar(nota, 0, 5)),
              docente: equipo[0],
            });
          }
        }
      }
    }
    estudiantes.push(...propios.map(({ theta, delta, ...e }) => e));
  }

  // La calificación del semestre en curso queda abierta; los anteriores ya se cerraron.
  const periodosAbiertos = [periodoActual];

  const modulo1 = generarModulo1(azar, { cohortes, docentes, estudiantes, cursos, actual });

  return { semilla, cohortes, docentes, estudiantes, cursos, inscripciones, calificaciones, periodosAbiertos, modulo1 };
};

module.exports = { generar, CATALOGO, CLASE_UNICA, CRITERIOS_POR_RA, DOMINIO, PREFIJO_COHORTE, aIndice, aPeriodo };
