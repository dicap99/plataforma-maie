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
        nombre: TEMAS[k.codigo] ? azar.elegir(TEMAS[k.codigo]) : null,
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

  return { semilla, cohortes, docentes, estudiantes, cursos, inscripciones, calificaciones, periodosAbiertos };
};

module.exports = { generar, CATALOGO, CRITERIOS_POR_RA, DOMINIO, PREFIJO_COHORTE, aIndice, aPeriodo };
