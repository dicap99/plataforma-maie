// RF-RA-03 / RF-RA-04 — Clasificación de niveles y reportes de RA
// Reportes por estudiante, curso, módulo curricular, promoción y programa, combinables con filtros.
// Unidad de análisis: el nivel de un estudiante en un RA (promedio de sus rúbricas completas dentro
// de los filtros). Agrupado por curso o por módulo, la unidad se toma dentro de cada grupo.
const ExcelJS = require('exceljs');
const { NIVELES, CLAVES_NIVEL, agruparUnidades, distribucion, validacion, nivelDeNota } = require('../rubrica');
const repository = require('./reportes.repository');

const META_POR_DEFECTO = 70;

// Cómo se agrupa cada reporte: clave del grupo, etiqueta legible y criterio de orden.
const DIMENSIONES = {
  ra: { grupo: (f) => f.ra, etiqueta: (f) => f.ra, orden: (f) => f.id_ra },
  curso: {
    grupo: (f) => f.id_curso,
    etiqueta: (f) => `${f.curso_codigo} · ${f.curso_nombre} · Prom. ${f.cohorte} · ${f.periodo}`,
    orden: (f) => `${f.periodo_inicio}|${String(f.curso_orden).padStart(2, '0')}|${f.grupo}`,
  },
  catalogo: { grupo: (f) => f.id_catalogo, etiqueta: (f) => f.curso_codigo, orden: (f) => f.curso_orden },
  modulo: { grupo: (f) => f.id_modulo, etiqueta: (f) => f.modulo, orden: (f) => f.id_modulo },
  cohorte: { grupo: (f) => f.id_cohorte, etiqueta: (f) => `Promoción ${f.cohorte}`, orden: (f) => f.periodo_inicio },
  estudiante: {
    grupo: (f) => f.id_estudiante,
    etiqueta: (f) => f.estudiante,
    orden: (f) => f.estudiante,
  },
};
const AGRUPACIONES = Object.keys(DIMENSIONES);

const filtrosDe = (query) => ({
  cohorte: query.cohorte,
  periodo: query.periodo,
  modulo: query.modulo,
  catalogo: query.catalogo,
  curso: query.curso,
  ra: query.ra,
  estudiante: query.estudiante,
});

const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Unidades (grupo, estudiante, RA) con su total consolidado.
const unidades = (filas, dimension) =>
  agruparUnidades(filas, (f) => `${dimension.grupo(f)}|${f.id_estudiante}|${f.id_ra}`);

const tabla = (filas, dimension, meta) => {
  const us = unidades(filas, dimension).map((u) => ({ ...u, _grupo: dimension.grupo(u) }));
  const base = new Map(us.map((u) => [u._grupo, u]));
  return distribucion(us, '_grupo')
    .map((d) => {
      const u = base.get(d.grupo);
      return { ...d, etiqueta: dimension.etiqueta(u), _orden: dimension.orden(u), validacion: validacion(d, meta) };
    })
    .sort((a, b) => comparar(a._orden, b._orden))
    .map(({ _orden, ...d }) => d);
};

const consultar = async (query) => {
  const agrupar = query.agrupar ?? 'ra';
  const filtros = filtrosDe(query);
  const [todas, ras, metaBD] = await Promise.all([
    repository.resultados(filtros), repository.listRA(), repository.metaSatisfactorio(),
  ]);
  const meta = metaBD ?? META_POR_DEFECTO;
  const completas = todas.filter((f) => f.completo);

  // Matriz por RA (siempre las 7 filas, aunque no tengan datos), como en el mockup del coordinador.
  const porRAconDatos = new Map(tabla(completas, DIMENSIONES.ra, meta).map((d) => [d.grupo, d]));
  const vacio = { ...Object.fromEntries(CLAVES_NIVEL.map((n) => [n, 0])), evaluados: 0, promedio: null,
    pct: Object.fromEntries(CLAVES_NIVEL.map((n) => [n, 0])) };
  const porRA = ras.map((r) => ({
    ...vacio, ...porRAconDatos.get(r.codigo), grupo: r.codigo, etiqueta: r.codigo, id_ra: r.id_ra, descripcion: r.descripcion,
    validacion: porRAconDatos.get(r.codigo)?.validacion ?? 'Sin datos',
  }));

  let filas = agrupar === 'ra' ? porRA : tabla(completas, DIMENSIONES[agrupar], meta);
  if (agrupar === 'estudiante') {
    // Nota y nivel de cada estudiante en cada RA, para la tabla estudiante × RA.
    const detalle = new Map();
    for (const u of unidades(completas, DIMENSIONES.estudiante)) {
      if (!detalle.has(u.id_estudiante)) detalle.set(u.id_estudiante, {});
      detalle.get(u.id_estudiante)[u.ra] = { total: u.total, nivel: u.nivel };
    }
    filas = filas.map((f) => ({ ...f, detalle: detalle.get(f.grupo) ?? {} }));
  }

  const unidadesRA = unidades(completas, DIMENSIONES.ra);
  const logro = unidadesRA.filter((u) => u.nivel === 'Alto' || u.nivel === 'Medio').length;

  return {
    meta: {
      agrupar,
      filtros: { ...filtros },
      niveles: NIVELES,
      meta_satisfactorio_pct: meta,
      estudiantes_evaluados: new Set(completas.map((f) => f.id_estudiante)).size,
      unidades: unidadesRA.length,
      cumplimiento: unidadesRA.length ? logro / unidadesRA.length : null,
      ras_en_riesgo: porRA.filter((r) => r.validacion === 'En riesgo').length,
      rubricas_incompletas: todas.length - completas.length,
    },
    porRA,
    filas,
    // Perfil de un estudiante: su resultado en cada RA de cada curso, incluidas rúbricas sin terminar.
    ...(query.estudiante ? {
      detalleEstudiante: todas.map((f) => ({
        curso_codigo: f.curso_codigo, curso_nombre: f.curso_nombre, periodo: f.periodo, cohorte: f.cohorte, ra: f.ra,
        total: f.completo ? f.total : null, nivel: f.completo ? nivelDeNota(f.total) : null, completo: f.completo,
      })),
    } : {}),
    _completas: completas,
  };
};

// --- Exportación a Excel ------------------------------------------------------
const ENCABEZADO = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF040039' } } };

const hoja = (libro, nombre, columnas, filas) => {
  const h = libro.addWorksheet(nombre);
  h.columns = columnas.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho ?? 14, style: c.formato ? { numFmt: c.formato } : {} }));
  h.getRow(1).eachCell((celda) => Object.assign(celda, ENCABEZADO));
  h.views = [{ state: 'frozen', ySplit: 1 }];
  filas.forEach((f) => h.addRow(f));
  return h;
};

const COLUMNAS_DISTRIBUCION = [
  { clave: 'etiqueta', titulo: 'Grupo', ancho: 44 },
  { clave: 'evaluados', titulo: 'Evaluados' },
  ...NIVELES.map((n) => ({ clave: n.nivel, titulo: n.etiqueta })),
  ...NIVELES.map((n) => ({ clave: `pct_${n.nivel}`, titulo: `% ${n.etiqueta}`, formato: '0.0%' })),
  { clave: 'promedio', titulo: 'Promedio', formato: '0.00' },
  { clave: 'validacion', titulo: 'Validación' },
];
const aplanar = (d) => ({ ...d, ...Object.fromEntries(CLAVES_NIVEL.map((n) => [`pct_${n}`, d.pct[n]])) });

module.exports = {
  AGRUPACIONES,

  async consolidado({ query }) {
    const { _completas, ...reporte } = await consultar(query);
    return reporte;
  },

  async exportar({ query }) {
    const filtros = filtrosDe(query);
    const [reporte, detalle] = await Promise.all([consultar(query), repository.detalleCriterios(filtros)]);
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Plataforma MaIE';

    hoja(libro, 'Distribución por RA', [{ clave: 'descripcion', titulo: 'Resultado de aprendizaje', ancho: 60 }, ...COLUMNAS_DISTRIBUCION],
      reporte.porRA.map((d) => aplanar({ ...d, etiqueta: d.grupo, descripcion: `${d.grupo}. ${d.descripcion}` })));
    if (reporte.meta.agrupar !== 'ra') {
      hoja(libro, `Por ${reporte.meta.agrupar}`, COLUMNAS_DISTRIBUCION, reporte.filas.map(aplanar));
    }

    // Estudiante × RA: nivel consolidado de cada estudiante en cada RA.
    const ras = reporte.porRA.map((r) => r.grupo);
    const porEstudiante = new Map();
    for (const u of unidades(reporte._completas, DIMENSIONES.ra)) {
      if (!porEstudiante.has(u.id_estudiante)) {
        porEstudiante.set(u.id_estudiante, { identificacion: u.identificacion, estudiante: u.estudiante, cohorte: u.cohorte });
      }
      porEstudiante.get(u.id_estudiante)[u.ra] = u.total;
      porEstudiante.get(u.id_estudiante)[`${u.ra}_nivel`] = NIVELES.find((n) => n.nivel === u.nivel).etiqueta;
    }
    hoja(libro, 'Estudiante × RA', [
      { clave: 'identificacion', titulo: 'Identificación' }, { clave: 'estudiante', titulo: 'Estudiante', ancho: 34 },
      { clave: 'cohorte', titulo: 'Promoción' },
      ...ras.flatMap((ra) => [{ clave: ra, titulo: ra, formato: '0.00', ancho: 8 }, { clave: `${ra}_nivel`, titulo: `Nivel ${ra}`, ancho: 12 }]),
    ], [...porEstudiante.values()].sort((a, b) => comparar(a.estudiante, b.estudiante)));

    hoja(libro, 'Detalle por criterio', [
      { clave: 'cohorte', titulo: 'Promoción' }, { clave: 'periodo', titulo: 'Periodo' },
      { clave: 'curso_codigo', titulo: 'Curso' }, { clave: 'curso_nombre', titulo: 'Nombre del curso', ancho: 30 },
      { clave: 'ra', titulo: 'RA', ancho: 6 }, { clave: 'orden', titulo: 'Criterio', ancho: 8 },
      { clave: 'nombre_criterio', titulo: 'Descripción del criterio', ancho: 50 },
      { clave: 'peso_porcentaje', titulo: 'Peso (%)', ancho: 9 },
      { clave: 'identificacion', titulo: 'Identificación' }, { clave: 'estudiante', titulo: 'Estudiante', ancho: 34 },
      { clave: 'calificacion', titulo: 'Nota', formato: '0.00', ancho: 8 }, { clave: 'nivel', titulo: 'Nivel', ancho: 12 },
    ], detalle.map((d) => ({ ...d, nivel: NIVELES.find((n) => n.nivel === d.nivel)?.etiqueta ?? d.nivel })));

    const fecha = new Date().toISOString().slice(0, 10);
    return { nombreArchivo: `Resultados_RA_MaIE_${fecha}.xlsx`, buffer: await libro.xlsx.writeBuffer() };
  },
};
