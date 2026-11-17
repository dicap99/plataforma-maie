// Categorización de usuarios del Módulo 3: QUIÉN evalúa a QUIÉN y con QUÉ formulario (Acuerdo 058,
// Art. 3–6). Funciones puras, sin BD ni Express; el servicio les pasa las ofertas del semestre y las
// inscripciones, y aquí se decide todo. La matriz completa, con su fuente, está en MATRIZ y en
// PENDIENTES.md §8.
//
// Unidad evaluada: el DOCENTE en una PROMOCIÓN y un SEMESTRE académico (como en «Estadísticas Evaluación
// Docente MaIE.xlsx», donde cada bloque es docente + promoción en una hoja por semestre). La evaluación no
// se vincula a la materia (decisión del 17-oct-2026): las ofertas (cursos + curso_docentes) solo dicen
// qué estudiantes tuvieron a qué docente en el semestre.

const FORMULARIOS = ['EE', 'EC', 'AE'];
const POBLACIONES = ['posgrado', 'pregrado'];

// Matriz de categorización (se documenta en PENDIENTES.md §8 y se expone en GET /eval-docente/categorizacion).
const MATRIZ = [
  {
    evaluador: 'Estudiante de posgrado', formulario: 'EE', evalua_a: 'Cada docente de cada oferta en la que está inscrito en el semestre',
    condicion: 'Inscrito en la oferta (curso_estudiantes), cuenta activa y no retirado de su promoción',
    fuente: 'Acuerdo 058, Art. 3 («estudiantes que toman el curso») y Art. 4',
  },
  {
    evaluador: 'Estudiante de pregrado', formulario: 'EE', evalua_a: 'Cada docente de cada oferta de la maestría que cursa en el semestre',
    condicion: 'En la lista de pregrado de la oferta (curso_estudiantes_pregrado), no retirado, y el semestre habilitado también para pregrado',
    fuente: 'Acuerdo 058, Art. 3 y Art. 4; asesoría del 20-oct-2026 (habilitar solo posgrado o también pregrado)',
  },
  {
    evaluador: 'Coordinación', formulario: 'EC', evalua_a: 'Cada docente con oferta en el semestre (una EC por docente y promoción)',
    condicion: 'Rol coordinador; no evalúa con EC su propio perfil docente (conflicto de interés)',
    fuente: 'Acuerdo 058, Art. 3 («evaluación realizada por el coordinador») y Art. 5',
  },
  {
    evaluador: 'El propio docente', formulario: 'AE', evalua_a: 'Sí mismo, en cada promoción en la que tiene oferta en el semestre',
    condicion: 'Cuenta vinculada al perfil docente (docentes_perfil.id_usuario); también si su rol es coordinador',
    fuente: 'Acuerdo 058, Art. 3 («autoevaluación») y Art. 6',
  },
  {
    evaluador: 'Docente (a otro docente)', formulario: '—', evalua_a: 'Nadie',
    condicion: 'El Acuerdo no prevé evaluación entre pares',
    fuente: 'Acuerdo 058, Art. 3 (solo tres fuentes)',
  },
];

// Casos borde (cada regla tiene prueba en tests/categorizacion.test.js).
const CASOS_BORDE = [
  { caso: 'Docente con varias ofertas en la misma promoción', regla: 'Una sola unidad (docente, promoción): el estudiante lo evalúa una vez' },
  { caso: 'Docente con ofertas en dos promociones del semestre', regla: 'Dos unidades, como en el Excel (p. ej. el mismo docente en las promociones 2 y 3 de 2022-A)' },
  { caso: 'Oferta con varios docentes', regla: 'El estudiante evalúa a cada docente por separado' },
  { caso: 'Estudiante en varios cursos del mismo docente', regla: 'Evalúa al docente una vez en el semestre (constancia única por estudiante, docente y semestre)' },
  { caso: 'Estudiante con el mismo docente en ofertas de dos promociones', regla: 'Una sola evaluación; cuenta en su propia promoción si es una de ellas, si no en la promoción más antigua ❓' },
  { caso: 'Estudiante de posgrado y de pregrado a la vez para el mismo docente', regla: 'Cuenta como posgrado' },
  { caso: 'Estudiante retirado (promoción o lista de pregrado) o cuenta inactiva', regla: 'No evalúa' },
  { caso: 'Pregrado con el semestre habilitado solo para posgrado', regla: 'No evalúa' },
  { caso: 'Docente externo o UDENAR', regla: 'Sin distinción: el Acuerdo aplica a todos los docentes del programa; la afiliación solo se informa' },
  { caso: 'Docente sin cuenta en la plataforma', regla: 'Recibe EE y EC; su AE queda pendiente hasta que Coordinación le cree la cuenta' },
  { caso: 'Docente que también es coordinador', regla: 'Diligencia su AE; nadie le diligencia la EC en la plataforma ❓ (conflicto de interés)' },
];

const clave = (idDocente, idCohorte) => `${idDocente}|${idCohorte}`;
const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Unidades evaluables del semestre a partir de sus ofertas.
// ofertas: [{ id_curso, id_cohorte, cohorte, cohorte_inicio, clase, docentes: [{ id_docente, id_usuario, nombre, afiliacion }] }]
const unidadesDelPeriodo = (ofertas) => {
  const mapa = new Map();
  for (const o of ofertas) {
    for (const d of o.docentes ?? []) {
      const k = clave(d.id_docente, o.id_cohorte);
      if (!mapa.has(k)) {
        mapa.set(k, {
          id_docente: d.id_docente, docente: d.nombre, afiliacion: d.afiliacion ?? null, id_usuario_docente: d.id_usuario ?? null,
          id_cohorte: o.id_cohorte, cohorte: o.cohorte, cohorte_inicio: o.cohorte_inicio, cursos: [],
        });
      }
      mapa.get(k).cursos.push({ id_curso: o.id_curso, clase: o.clase });
    }
  }
  return [...mapa.values()].sort((a, b) => comparar(a.cohorte_inicio, b.cohorte_inicio) || comparar(a.docente, b.docente));
};

// Si una inscripción habilita al estudiante para el EE.
// posgrado: { activo, estado_promocion } — estado en cohorte_estudiantes; pregrado: { activo, estado }.
const inscripcionVigente = (i, poblacion, { incluyePregrado }) => {
  if (i.activo === false) return false;
  if (poblacion === 'pregrado') return incluyePregrado && i.estado !== 'retirado';
  return i.estado_promocion !== 'retirado';
};

// Evaluaciones EE que debe diligenciar cada estudiante en el semestre.
// posgrado: [{ id_curso, id_estudiante, id_cohorte_estudiante, estado_promocion, activo }]
// pregrado: [{ id_curso, id_estudiante, estado, activo }]
// Devuelve Map id_estudiante → [{ id_docente, docente, id_cohorte, cohorte, poblacion, cursos }].
const asignacionesEstudiantes = ({ ofertas, posgrado = [], pregrado = [], incluyePregrado = false }) => {
  const ofertaDe = new Map(ofertas.map((o) => [o.id_curso, o]));
  // Candidatos por (estudiante, docente): cada oferta común, con la población por la que la cursa.
  const candidatos = new Map();
  const agregar = (i, poblacion) => {
    const o = ofertaDe.get(i.id_curso);
    if (!o || !inscripcionVigente(i, poblacion, { incluyePregrado })) return;
    for (const d of o.docentes ?? []) {
      const k = `${i.id_estudiante}|${d.id_docente}`;
      if (!candidatos.has(k)) candidatos.set(k, { id_estudiante: i.id_estudiante, docente: d, propia: null, ofertas: [] });
      const c = candidatos.get(k);
      c.ofertas.push({ oferta: o, poblacion });
      if (poblacion === 'posgrado' && i.id_cohorte_estudiante) c.propia = i.id_cohorte_estudiante;
    }
  };
  posgrado.forEach((i) => agregar(i, 'posgrado'));
  pregrado.forEach((i) => agregar(i, 'pregrado'));

  const resultado = new Map();
  for (const c of candidatos.values()) {
    const poblacion = c.ofertas.some((x) => x.poblacion === 'posgrado') ? 'posgrado' : 'pregrado';
    // Promoción en la que cuenta la evaluación: la propia del estudiante si cursa con el docente en ella;
    // si no, la promoción más antigua entre sus ofertas con ese docente.
    const ordenadas = [...c.ofertas].sort((a, b) => comparar(a.oferta.cohorte_inicio, b.oferta.cohorte_inicio) || a.oferta.id_cohorte - b.oferta.id_cohorte);
    const elegida = ordenadas.find((x) => x.oferta.id_cohorte === c.propia) ?? ordenadas[0];
    if (!resultado.has(c.id_estudiante)) resultado.set(c.id_estudiante, []);
    resultado.get(c.id_estudiante).push({
      id_docente: c.docente.id_docente,
      docente: c.docente.nombre,
      id_cohorte: elegida.oferta.id_cohorte,
      cohorte: elegida.oferta.cohorte,
      poblacion,
      cursos: [...new Set(c.ofertas.map((x) => x.oferta.clase))].sort(),
    });
  }
  for (const lista of resultado.values()) lista.sort((a, b) => comparar(a.docente, b.docente));
  return resultado;
};

const permitir = (extra = {}) => ({ permitido: true, ...extra });
const negar = (motivo) => ({ permitido: false, motivo });

// ¿Puede `actor` diligenciar el formulario `tipo` sobre `objetivo`?
// actor: { rol, id_usuario, id_docente_propio } (perfil docente vinculado a su cuenta, o null)
// objetivo: { id_docente, id_cohorte } (en EE basta id_docente: la promoción la fija la asignación)
// contexto: { unidades (unidadesDelPeriodo), asignaciones (del estudiante, si el actor es estudiante) }
const autorizar = (actor, tipo, objetivo, { unidades = [], asignaciones = [] } = {}) => {
  if (!FORMULARIOS.includes(tipo)) return negar(`Formulario desconocido: ${tipo}`);
  if (tipo === 'EE') {
    if (actor.rol !== 'estudiante') return negar('El formulario EE es solo para estudiantes (Acuerdo 058, Art. 3)');
    const a = asignaciones.find((x) => x.id_docente === objetivo.id_docente);
    if (!a) return negar('Solo puede evaluar a los docentes de los cursos en los que está inscrito en el semestre');
    return permitir({ id_cohorte: a.id_cohorte, poblacion: a.poblacion });
  }
  const unidad = unidades.find((u) => u.id_docente === objetivo.id_docente && u.id_cohorte === objetivo.id_cohorte);
  if (tipo === 'EC') {
    if (actor.rol !== 'coordinador') return negar('El formulario EC es solo para Coordinación (Acuerdo 058, Art. 5)');
    if (!unidad) return negar('El docente no tiene oferta en esa promoción en el semestre');
    if (actor.id_docente_propio && actor.id_docente_propio === objetivo.id_docente) {
      return negar('Coordinación no puede evaluarse a sí misma con el formulario EC (conflicto de interés)');
    }
    return permitir({ id_cohorte: unidad.id_cohorte });
  }
  // AE
  if (!['docente', 'coordinador'].includes(actor.rol) || !actor.id_docente_propio) {
    return negar('La autoevaluación (AE) la diligencia el propio docente con su cuenta vinculada al perfil docente');
  }
  if (actor.id_docente_propio !== objetivo.id_docente) return negar('Solo puede diligenciar su propia autoevaluación');
  if (!unidad) return negar('No tiene oferta en esa promoción en el semestre');
  return permitir({ id_cohorte: unidad.id_cohorte });
};

// Formularios que le corresponden al actor en el semestre, con su estado.
// hechas: { ee: Set(id_docente) del estudiante; ecAe: Set(`${tipo}|${id_docente}|${id_cohorte}`) }
const pendientesDe = (actor, { unidades = [], asignaciones = [] }, { ee = new Set(), ecAe = new Set() } = {}) => {
  if (actor.rol === 'estudiante') {
    return asignaciones.map((a) => ({ tipo: 'EE', ...a, diligenciado: ee.has(a.id_docente) }));
  }
  const lista = [];
  if (actor.rol === 'coordinador') {
    for (const u of unidades) {
      if (actor.id_docente_propio && u.id_docente === actor.id_docente_propio) continue;
      lista.push({ tipo: 'EC', ...u, diligenciado: ecAe.has(`EC|${u.id_docente}|${u.id_cohorte}`) });
    }
  }
  if (actor.id_docente_propio) {
    for (const u of unidades.filter((x) => x.id_docente === actor.id_docente_propio)) {
      lista.push({ tipo: 'AE', ...u, diligenciado: ecAe.has(`AE|${u.id_docente}|${u.id_cohorte}`) });
    }
  }
  return lista;
};

// Fecha local AAAA-MM-DD.
const isoLocal = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

// Si el semestre recibe respuestas hoy: habilitado por Coordinación, no publicado y dentro de las fechas
// del cronograma cuando están definidas (Art. 10).
const recibeRespuestas = (periodo, hoy = new Date()) => {
  if (!periodo) return { abierta: false, motivo: 'La evaluación docente de este semestre no está habilitada' };
  if (periodo.publicado) return { abierta: false, motivo: 'Los resultados del semestre ya se publicaron' };
  if (!periodo.habilitada) return { abierta: false, motivo: 'La evaluación docente de este semestre no está habilitada' };
  const dia = isoLocal(hoy);
  const fecha = (f) => (f ? String(f).slice(0, 10) : null);
  if (fecha(periodo.fecha_apertura) && dia < fecha(periodo.fecha_apertura)) {
    return { abierta: false, motivo: `La evaluación abre el ${fecha(periodo.fecha_apertura)}` };
  }
  if (fecha(periodo.fecha_cierre) && dia > fecha(periodo.fecha_cierre)) {
    return { abierta: false, motivo: `La evaluación cerró el ${fecha(periodo.fecha_cierre)}` };
  }
  return { abierta: true, motivo: null };
};

module.exports = {
  FORMULARIOS,
  POBLACIONES,
  MATRIZ,
  CASOS_BORDE,
  unidadesDelPeriodo,
  asignacionesEstudiantes,
  autorizar,
  pendientesDe,
  recibeRespuestas,
};
