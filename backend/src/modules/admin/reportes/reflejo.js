// Reflejo de Gestión académica en las hojas del Módulo 1 (Información académica y Panel general).
// La «Producción científica» de una promoción con productos registrados (hoja «Productos de investigación»)
// también se calcula: un conteo por tipo y la lista de citas.
// Híbrido: si una promoción tiene registros en Gestión (estudiantes con su promoción y beca; en cursos y
// docentes, cada semestre con clases ofertadas), sus cifras se calculan desde ahí; si no, se conservan las de la hoja
// (registro histórico importado del Excel). Cada fila indica su `origen`: 'gestion' o 'registro'.
const db = require('../../../config/db');
const { TIPOS_BENEFICIO } = require('../../../utils/beneficios');
const { TIPOS_PRODUCTO } = require('../recursos/recursos.definicion');

// Columna de «Producción científica» de cada tipo de producto.
const COLUMNA_PRODUCTO = { Artículo: 'articulos', Ponencia: 'ponencias', Software: 'software', Prototipo: 'prototipos', Tesis: 'tesis' };

const BECAS = Object.fromEntries(TIPOS_BENEFICIO.filter((t) => t.beca).map((t) => [t.valor, t.columna]));
const AYUDAS = TIPOS_BENEFICIO.filter((t) => !t.beca).map((t) => t.columna);

// --- Consultas ---------------------------------------------------------------------
const estudiantesPorCohorte = async () =>
  (await db.query(`
    SELECT id_cohorte,
           COUNT(*)::int AS inscritos,
           COUNT(*) FILTER (WHERE estado <> 'inscrito')::int AS matriculados,
           COUNT(*) FILTER (WHERE estado IN ('egresado', 'graduado'))::int AS egresados,
           COUNT(*) FILTER (WHERE estado = 'graduado')::int AS graduados
    FROM cohorte_estudiantes
    GROUP BY id_cohorte`)).rows;

// Estudiantes con cada beneficio en algún semestre. Quien no tiene semestres registrados cuenta con la
// beca de su promoción (cohorte_estudiantes.beca). `por_semestre`: la promoción ya registra beneficios
// por semestre, así que asistentes y ayudantes también salen de ahí y no de la hoja.
const beneficiosPorCohorte = async () =>
  (await db.query(`
    WITH b AS (
      SELECT id_cohorte, id_estudiante, tipo FROM estudiante_beneficios
      UNION
      SELECT he.id_cohorte, he.id_estudiante, he.beca FROM cohorte_estudiantes he
      WHERE he.beca IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM estudiante_beneficios x WHERE x.id_cohorte = he.id_cohorte AND x.id_estudiante = he.id_estudiante)
    )
    SELECT id_cohorte,
           ${TIPOS_BENEFICIO.map((t) => `COUNT(DISTINCT id_estudiante) FILTER (WHERE tipo = '${t.valor}')::int AS ${t.columna}`).join(', ')},
           EXISTS (SELECT 1 FROM estudiante_beneficios x WHERE x.id_cohorte = b.id_cohorte) AS por_semestre
    FROM b
    GROUP BY id_cohorte`)).rows;

// Semestre de la promoción en que cae un periodo: 1 en su periodo de inicio, 2 en el siguiente…
// (p. ej. 2022-A es el semestre III de una promoción que empezó en 2021-A). No es el semestre del plan:
// un curso puede dictarse en otro semestre que el previsto.
const SEMESTRE_REAL = `((SUBSTRING(c.periodo FROM 1 FOR 4)::int - SUBSTRING(h.periodo_inicio FROM 1 FOR 4)::int) * 2
  + (CASE WHEN RIGHT(c.periodo, 1) = 'B' THEN 1 ELSE 0 END)
  - (CASE WHEN RIGHT(h.periodo_inicio, 1) = 'B' THEN 1 ELSE 0 END) + 1)`;

// Clases ofertadas por promoción y semestre, con sus docentes según la afiliación del perfil.
const ofertasPorCohorte = async () =>
  (await db.query(`
    SELECT c.id_cohorte, ${SEMESTRE_REAL} AS semestre,
           COUNT(DISTINCT c.id_curso)::int AS n_cursos,
           COUNT(DISTINCT cd.id_docente) FILTER (WHERE d.afiliacion = 'UDENAR')::int AS docentes_udenar,
           COUNT(DISTINCT cd.id_docente) FILTER (WHERE d.afiliacion = 'EXTERNO')::int AS docentes_externos
    FROM cursos c
    JOIN cohortes h ON h.id_cohorte = c.id_cohorte
    LEFT JOIN curso_docentes cd ON cd.id_curso = c.id_curso
    LEFT JOIN docentes_perfil d ON d.id_docente = cd.id_docente
    WHERE ${SEMESTRE_REAL} BETWEEN 1 AND 4
    GROUP BY c.id_cohorte, semestre`)).rows;

// Contratos OPS con el nombre de la promoción atendida (si la tienen).
const contratosOps = async () =>
  (await db.query(`
    SELECT o.periodo, o.valor, h.nombre AS cohorte
    FROM contratos_ops o LEFT JOIN cohortes h ON h.id_cohorte = o.id_cohorte
    ORDER BY o.periodo, h.periodo_inicio`)).rows;

const pasantiasDetalle = async () =>
  (await db.query('SELECT id_cohorte, tipo FROM pasantias_detalle')).rows;

const pagosPregrado = async () =>
  (await db.query(`
    SELECT mf.id_cohorte, mf.periodo,
           COUNT(DISTINCT mf.id_estudiante)::int AS estudiantes,
           COALESCE(SUM(mf.valor_pagado), 0)::float8 AS ingreso
    FROM matriculas_financieras mf
    WHERE mf.poblacion = 'pregrado' AND mf.pagado = TRUE AND mf.id_cohorte IS NOT NULL
    GROUP BY mf.id_cohorte, mf.periodo`)).rows;

const inscripcionesPregrado = async () =>
  (await db.query(`
    SELECT c.id_cohorte, c.periodo, COUNT(*)::int AS inscripciones
    FROM curso_estudiantes_pregrado cp
    JOIN cursos c ON c.id_curso = cp.id_curso
    WHERE cp.estado <> 'retirado'
    GROUP BY c.id_cohorte, c.periodo`)).rows;

const recaudoMatriculas = async () =>
  (await db.query(`
    SELECT mf.id_cohorte, h.nombre AS cohorte,
           COALESCE(SUM(mf.valor_pagado) FILTER (WHERE mf.pagado AND mf.poblacion = 'posgrado'), 0)::float8 AS posgrado,
           COALESCE(SUM(mf.valor_pagado) FILTER (WHERE mf.pagado AND mf.poblacion = 'pregrado'), 0)::float8 AS pregrado,
           COALESCE(SUM(mf.valor_pagado) FILTER (WHERE mf.pagado), 0)::float8 AS total
    FROM matriculas_financieras mf
    LEFT JOIN cohortes h ON h.id_cohorte = mf.id_cohorte
    GROUP BY mf.id_cohorte, h.nombre, h.periodo_inicio
    ORDER BY h.periodo_inicio NULLS LAST, h.nombre`)).rows;

// --- Combinación (funciones puras) -------------------------------------------------------
// Promociones: inscritos, matriculados, egresados y graduados desde los estudiantes registrados.
// Los aprobados por semestre siguen saliendo de la hoja.
// Sin egresados registrados la promoción queda en curso (null); si ya terminó, las alertas lo señalan.
// `registro_parcial`: hay menos matriculados registrados en Gestión que en la hoja; las cifras salen de
//   Gestión (registro incompleto) y se avisa en la tabla y en las alertas del Panel general.
const combinarCohortes = (hoja, estudiantes) => {
  const est = new Map(estudiantes.map((e) => [e.id_cohorte, e]));
  return hoja.map((c) => {
    const e = est.get(c.id_cohorte);
    if (!e) return { ...c, origen: 'registro' };
    const parcial = typeof c.matriculados === 'number' && e.matriculados < c.matriculados;
    return {
      ...c,
      inscritos: e.inscritos,
      matriculados: e.matriculados,
      egresados: e.egresados > 0 ? e.egresados : null, // sin egresados aún: promoción en curso
      graduados: e.graduados,
      origen: 'gestion',
      ...(parcial ? { registro_parcial: { registrados: e.matriculados, en_hoja: c.matriculados } } : {}),
    };
  });
};

// Beneficios: becas por tipo desde los estudiantes; asistentes y ayudantes, de la hoja, salvo que la
// promoción registre beneficios por semestre (`por_semestre`). `reflejados`: columnas calculadas de la fila.
const combinarBeneficios = (hoja, estudiantes, cohortes) => {
  const est = new Map(estudiantes.map((e) => [e.id_cohorte, e]));
  const nombre = new Map(cohortes.map((c) => [c.id_cohorte, c.nombre]));
  const calculadas = (e) => [...Object.values(BECAS), ...(e.por_semestre ? AYUDAS : [])];
  const desde = (e) => Object.fromEntries(calculadas(e).map((k) => [k, e[k] ?? 0]));
  const filas = hoja.map((b) => {
    const e = est.get(b.id_cohorte);
    if (!e) return { ...b, origen: 'registro' };
    return { ...b, ...desde(e), origen: 'gestion', reflejados: calculadas(e) };
  });
  // Promociones con estudiantes registrados pero sin fila en la hoja (`sin_registro`: al editarla se crea).
  for (const e of estudiantes) {
    if (filas.some((b) => b.id_cohorte === e.id_cohorte) || !nombre.has(e.id_cohorte)) continue;
    filas.push({
      id_cohorte: e.id_cohorte, cohorte: nombre.get(e.id_cohorte),
      asistentes_investigacion: 0, ayudantes_docencia: 0, ...desde(e),
      origen: 'gestion', sin_registro: true, reflejados: calculadas(e),
    });
  }
  return filas;
};

// Producción científica: las promociones con productos registrados cuentan sus productos por tipo y
// listan las citas en «detalles»; las demás conservan la hoja.
const combinarProduccion = (hoja, productos, cohortes) => {
  const columnas = TIPOS_PRODUCTO.map((t) => COLUMNA_PRODUCTO[t]);
  const porCohorte = new Map();
  for (const p of productos) porCohorte.set(p.id_cohorte, [...(porCohorte.get(p.id_cohorte) ?? []), p]);
  const calcular = (lista) => ({
    ...Object.fromEntries(columnas.map((c) => [c, 0])),
    ...Object.fromEntries(TIPOS_PRODUCTO.map((t) => [COLUMNA_PRODUCTO[t], lista.filter((p) => p.tipo === t).length])),
    detalles: lista.map((p) => `• ${p.tipo}: ${p.cita}${p.anio ? ` (${p.anio})` : ''}`).join('\n'),
    origen: 'gestion',
  });
  const nombre = new Map(cohortes.map((c) => [c.id_cohorte, c.nombre]));
  const filas = hoja.map((f) => (porCohorte.has(f.id_cohorte) ? { ...f, ...calcular(porCohorte.get(f.id_cohorte)) } : { ...f, origen: 'registro' }));
  for (const [id, lista] of porCohorte) {
    if (filas.some((f) => f.id_cohorte === id) || !nombre.has(id)) continue;
    filas.push({ id_cohorte: id, cohorte: nombre.get(id), ...calcular(lista), sin_registro: true });
  }
  return filas;
};

// Contrataciones OPS: cada periodo con contratos registrados (con nombres, «Contratos OPS») cuenta sus
// contratos, suma su valor y lista las promociones atendidas; los demás periodos conservan la hoja.
// `contratos`: [{ periodo, valor, cohorte }] (cohorte = nombre de la promoción o null).
const combinarContrataciones = (hoja, contratos) => {
  const porPeriodo = new Map();
  for (const c of contratos) porPeriodo.set(c.periodo, [...(porPeriodo.get(c.periodo) ?? []), c]);
  const calcular = (lista) => ({
    n_ops: lista.length,
    valor: lista.reduce((total, c) => total + Number(c.valor), 0),
    promociones: [...new Set(lista.map((c) => c.cohorte).filter(Boolean))].join(', ') || null,
    origen: 'gestion',
  });
  // Mientras no estén registrados todos los contratos reportados en la hoja para el periodo, se conserva el
  // total reportado (registrar uno solo no debe bajar el valor del semestre) y se informa el avance.
  const filas = hoja.map((f) => {
    const lista = porPeriodo.get(f.periodo);
    if (!lista) return { ...f, origen: 'registro' };
    if (lista.length < Number(f.n_ops ?? 0)) {
      return { ...f, origen: 'registro', registro_parcial: { registrados: lista.length, reportados: Number(f.n_ops) } };
    }
    return { ...f, ...calcular(lista) };
  });
  for (const [periodo, lista] of porPeriodo) {
    if (!filas.some((f) => f.periodo === periodo)) filas.push({ periodo, ...calcular(lista), sin_registro: true });
  }
  return filas.sort((a, b) => (a.periodo < b.periodo ? -1 : 1));
};

// Cursos y docentes por semestre: cada semestre con clases ofertadas sale de ellas; los demás
// semestres de la promoción conservan la hoja (p. ej. mientras se completan los históricos).
const combinarSemestres = (hoja, ofertas, cohortes) => {
  const clave = (f) => `${f.id_cohorte}|${f.semestre}`;
  const conOfertas = new Set(ofertas.map(clave));
  const nombre = new Map(cohortes.map((c) => [c.id_cohorte, c.nombre]));
  return [
    ...hoja.filter((s) => !conOfertas.has(clave(s))).map((s) => ({ ...s, origen: 'registro' })),
    ...ofertas.filter((o) => nombre.has(o.id_cohorte)).map((o) => ({ ...o, cohorte: nombre.get(o.id_cohorte), origen: 'gestion' })),
  ].sort((a, b) => a.id_cohorte - b.id_cohorte || a.semestre - b.semestre);
};

// Pasantías: las promociones con registros detallados en «Pasantías detalladas» calculan sus conteos
// nacionales e internacionales; las demás conservan la hoja histórica.
const combinarPasantias = (hoja, pasantias, cohortes) => {
  const porCohorte = new Map();
  for (const p of pasantias) porCohorte.set(p.id_cohorte, [...(porCohorte.get(p.id_cohorte) ?? []), p]);
  const calcular = (lista) => ({
    nacionales: lista.filter((p) => p.tipo === 'Nacional').length,
    internacionales: lista.filter((p) => p.tipo === 'Internacional').length,
    origen: 'gestion',
  });
  const nombre = new Map(cohortes.map((c) => [c.id_cohorte, c.nombre]));
  const filas = hoja.map((f) => (porCohorte.has(f.id_cohorte) ? { ...f, ...calcular(porCohorte.get(f.id_cohorte)) } : { ...f, origen: 'registro' }));
  for (const [id, lista] of porCohorte) {
    if (filas.some((f) => f.id_cohorte === id) || !nombre.has(id)) continue;
    filas.push({ id_cohorte: id, cohorte: nombre.get(id), ...calcular(lista), sin_registro: true });
  }
  return filas;
};

// Estudiantes de pregrado: cuando un (id_cohorte, periodo) tiene pagos registrados en matrícula financiera,
// calcula estudiantes pagados, inscripciones vigentes e ingreso real; los demás conservan la hoja histórica.
const combinarPregrado = (hoja, pagos, inscritos, cohortes = []) => {
  const clave = (f) => `${f.id_cohorte}|${f.periodo}`;
  const mapaPagos = new Map(pagos.map((p) => [clave(p), p]));
  const mapaInscritos = new Map(inscritos.map((i) => [clave(i), i.inscripciones]));
  const nombre = new Map(cohortes.map((c) => [c.id_cohorte, c.nombre]));
  const filas = hoja.map((f) => {
    const p = mapaPagos.get(clave(f));
    if (!p) return { ...f, origen: 'registro' };
    return {
      ...f,
      estudiantes: p.estudiantes,
      inscripciones: Math.max(p.estudiantes, mapaInscritos.get(clave(f)) ?? 0),
      ingreso: p.ingreso,
      origen: 'gestion',
    };
  });
  for (const [k, p] of mapaPagos) {
    if (filas.some((f) => clave(f) === k) || !nombre.has(p.id_cohorte)) continue;
    filas.push({
      id_cohorte: p.id_cohorte,
      cohorte: nombre.get(p.id_cohorte),
      periodo: p.periodo,
      estudiantes: p.estudiantes,
      inscripciones: Math.max(p.estudiantes, mapaInscritos.get(k) ?? 0),
      ingreso: p.ingreso,
      origen: 'gestion',
      sin_registro: true,
    });
  }
  return filas;
};

// Aplica el reflejo a las hojas ya cargadas: { cohortes, beneficios, 'cohorte-semestres', … }.
const aplicar = async (datos) => {
  const [conteos, beneficios, ofertas, productos, pasantias, contratos, pagosPreg, inscPreg] = await Promise.all([
    estudiantesPorCohorte(), beneficiosPorCohorte(), ofertasPorCohorte(),
    db.query('SELECT id_cohorte, tipo, cita, anio FROM productos_investigacion ORDER BY tipo, anio, cita').then((r) => r.rows),
    datos.pasantias ? pasantiasDetalle() : [],
    datos.contrataciones ? contratosOps() : [],
    datos.pregrado ? pagosPregrado() : [],
    datos.pregrado ? inscripcionesPregrado() : [],
  ]);
  const porCohorte = new Map(beneficios.map((b) => [b.id_cohorte, b]));
  const estudiantes = conteos.map((e) => ({ ...e, ...porCohorte.get(e.id_cohorte) }));
  return {
    ...datos,
    cohortes: combinarCohortes(datos.cohortes, estudiantes),
    beneficios: combinarBeneficios(datos.beneficios, estudiantes, datos.cohortes),
    'cohorte-semestres': combinarSemestres(datos['cohorte-semestres'], ofertas, datos.cohortes),
    produccion: combinarProduccion(datos.produccion, productos, datos.cohortes),
    ...(datos.pasantias ? { pasantias: combinarPasantias(datos.pasantias, pasantias, datos.cohortes) } : {}),
    // Solo cuando se cargó la hoja financiera (informe de Coordinación o reflejo financiero).
    ...(datos.contrataciones ? { contrataciones: combinarContrataciones(datos.contrataciones, contratos) } : {}),
    ...(datos.pregrado ? { pregrado: combinarPregrado(datos.pregrado, pagosPreg, inscPreg, datos.cohortes) } : {}),
  };
};

// Reflejo de las hojas financieras ya cargadas ({ contrataciones, pregrado, cohortes }), para Presupuesto y finanzas.
const aplicarFinanciero = async (datos) => {
  const [contratos, pagosPreg, inscPreg, recaudo] = await Promise.all([
    contratosOps(),
    datos.pregrado ? pagosPregrado() : [],
    datos.pregrado ? inscripcionesPregrado() : [],
    recaudoMatriculas(),
  ]);
  return {
    contrataciones: combinarContrataciones(datos.contrataciones, contratos),
    ...(datos.pregrado ? { pregrado: combinarPregrado(datos.pregrado, pagosPreg, inscPreg, datos.cohortes) } : {}),
    recaudo_matriculas: recaudo,
  };
};

module.exports = {
  SEMESTRE_REAL, aplicar, aplicarFinanciero, recaudoMatriculas,
  combinarCohortes, combinarBeneficios, combinarSemestres, combinarProduccion, combinarPasantias, combinarContrataciones, combinarPregrado,
  RECURSOS_REFLEJADOS: ['cohortes', 'beneficios', 'cohorte-semestres', 'produccion', 'pasantias'],
};
