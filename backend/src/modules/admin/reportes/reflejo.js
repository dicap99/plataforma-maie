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

// --- Combinación (funciones puras) -------------------------------------------------------
// Promociones: inscritos, matriculados, egresados y graduados desde los estudiantes registrados.
// Los aprobados por semestre siguen saliendo de la hoja.
const combinarCohortes = (hoja, estudiantes) => {
  const est = new Map(estudiantes.map((e) => [e.id_cohorte, e]));
  return hoja.map((c) => {
    const e = est.get(c.id_cohorte);
    if (!e) return { ...c, origen: 'registro' };
    return {
      ...c,
      inscritos: e.inscritos,
      matriculados: e.matriculados,
      egresados: e.egresados > 0 ? e.egresados : null, // sin egresados aún: promoción en curso
      graduados: e.graduados,
      origen: 'gestion',
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

// Aplica el reflejo a las hojas ya cargadas: { cohortes, beneficios, 'cohorte-semestres', … }.
const aplicar = async (datos) => {
  const [conteos, beneficios, ofertas, productos] = await Promise.all([
    estudiantesPorCohorte(), beneficiosPorCohorte(), ofertasPorCohorte(),
    db.query('SELECT id_cohorte, tipo, cita, anio FROM productos_investigacion ORDER BY tipo, anio, cita').then((r) => r.rows),
  ]);
  const porCohorte = new Map(beneficios.map((b) => [b.id_cohorte, b]));
  const estudiantes = conteos.map((e) => ({ ...e, ...porCohorte.get(e.id_cohorte) }));
  return {
    ...datos,
    cohortes: combinarCohortes(datos.cohortes, estudiantes),
    beneficios: combinarBeneficios(datos.beneficios, estudiantes, datos.cohortes),
    'cohorte-semestres': combinarSemestres(datos['cohorte-semestres'], ofertas, datos.cohortes),
    produccion: combinarProduccion(datos.produccion, productos, datos.cohortes),
  };
};

module.exports = {
  SEMESTRE_REAL, aplicar, combinarCohortes, combinarBeneficios, combinarSemestres, combinarProduccion,
  RECURSOS_REFLEJADOS: ['cohortes', 'beneficios', 'cohorte-semestres', 'produccion'],
};
