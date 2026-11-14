// Análisis del programa sobre los resultados de aprendizaje (asesoría 20-oct: «estadísticas,
// histograma»; documento RA MaIE: «distribución de los estudiantes en los diferentes niveles
// esperados»). Funciones puras, sin BD ni Express, para probarlas aisladas.
//
// Las reglas de nivel y de validación (meta del programa) viven SOLO en ../rubrica.js; aquí solo se
// agregan las unidades (estudiante, RA). No se redactan conclusiones ni se usan umbrales propios: la
// interpretación la hace Coordinación (decisión del usuario, 2026-11-13).
const { CLAVES_NIVEL, agruparUnidades, distribucion, nivelDeNota, redondear2, validacion } = require('../rubrica');

const ANCHO_INTERVALO = 0.5; // coincide con los cortes 3.0, 3.5 y 4.5 de la rúbrica

const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const fraccion = (n, d) => (d ? n / d : null);
// Unidades (clave, estudiante, RA) con el total consolidado; `clave` agrupa además por otra
// dimensión (promoción, semestre o curso del plan) para que un estudiante cuente una vez por grupo.
const unidades = (filas, clave = () => '') =>
  agruparUnidades(filas, (f) => `${clave(f)}|${f.id_estudiante}|${f.id_ra}`);

// Histograma de los totales estudiante–RA en intervalos de 0.5 (el último incluye el 5.0). Cada
// intervalo cae entero en un nivel de la rúbrica, que se informa para colorear la barra.
const histograma = (us) => {
  const n = Math.round(5 / ANCHO_INTERVALO);
  const bins = Array.from({ length: n }, (_, i) => {
    const desde = redondear2(i * ANCHO_INTERVALO);
    const hasta = redondear2((i + 1) * ANCHO_INTERVALO);
    return { desde, hasta, etiqueta: `${desde.toFixed(1)}–${hasta.toFixed(1)}`, nivel: nivelDeNota(desde), estudiantes: 0 };
  });
  for (const u of us) {
    if (u.total === null || u.total === undefined) continue;
    const i = Math.min(n - 1, Math.floor(Math.round(u.total * 100) / Math.round(ANCHO_INTERVALO * 100)));
    bins[i].estudiantes += 1;
  }
  return bins;
};

// Fila de resumen de un grupo: conteos por nivel, % satisfactorio, promedio y validación.
const resumenGrupo = (d, meta) => ({
  ...d,
  satisfactorio: d.Alto + d.Medio,
  pct_satisfactorio: fraccion(d.Alto + d.Medio, d.evaluados),
  validacion: validacion(d, meta),
});

// Serie por una dimensión ordenable (promoción o semestre) con el % satisfactorio global y por RA.
const evolucion = (filas, { grupo, etiqueta, orden }, ras, meta) => {
  const base = new Map();
  for (const f of filas) if (!base.has(grupo(f))) base.set(grupo(f), f);
  const us = unidades(filas, grupo);
  const total = new Map(distribucion(us, (u) => grupo(u)).map((d) => [d.grupo, d]));
  const porRA = new Map(distribucion(us, (u) => `${grupo(u)}|${u.ra}`).map((d) => [d.grupo, d]));
  return [...base.entries()]
    .sort((a, b) => comparar(orden(a[1]), orden(b[1])))
    .map(([g, f]) => {
      const d = resumenGrupo(total.get(g), meta);
      const ra = {};
      for (const codigo of ras) {
        const x = porRA.get(`${g}|${codigo}`);
        if (x) ra[codigo] = { evaluados: x.evaluados, pct_satisfactorio: fraccion(x.Alto + x.Medio, x.evaluados) };
      }
      return { grupo: g, etiqueta: etiqueta(f), ...d, ra };
    });
};

// Desempeño por criterio de la rúbrica (notas de rúbricas completas), del promedio más bajo al más alto.
const criterios = (notas) => {
  const grupos = new Map();
  for (const n of notas) {
    if (!grupos.has(n.id_criterio)) {
      grupos.set(n.id_criterio, {
        id_criterio: n.id_criterio, ra: n.ra, id_ra: n.id_ra, orden: n.orden, nombre: n.nombre_criterio,
        peso_porcentaje: n.peso_porcentaje, notas: 0, suma: 0, ...Object.fromEntries(CLAVES_NIVEL.map((k) => [k, 0])),
      });
    }
    const g = grupos.get(n.id_criterio);
    g.notas += 1;
    g.suma += n.calificacion;
    g[nivelDeNota(n.calificacion)] += 1;
  }
  return [...grupos.values()]
    .map(({ suma, ...g }) => {
      const promedio = redondear2(suma / g.notas);
      return { ...g, promedio, nivel: nivelDeNota(promedio), pct_insuficiente: g.Insuficiente / g.notas };
    })
    .sort((a, b) => a.promedio - b.promedio || b.pct_insuficiente - a.pct_insuficiente || a.id_criterio - b.id_criterio);
};

const DIM_COHORTE = { grupo: (f) => f.id_cohorte, etiqueta: (f) => `Promoción ${f.cohorte}`, orden: (f) => f.periodo_inicio };
const DIM_PERIODO = { grupo: (f) => f.periodo, etiqueta: (f) => f.periodo, orden: (f) => f.periodo };
const DIM_CATALOGO = { grupo: (f) => f.id_catalogo, etiqueta: (f) => `${f.curso_codigo} · ${f.curso_catalogo}`, orden: (f) => f.curso_orden };

// filas: resultados (oferta, estudiante, RA) completos; notas: notas por criterio de esas rúbricas;
// ras: catálogo RA1–RA7; meta: % mínimo en Alto o Medio (parámetro del programa).
const analizar = ({ filas, notas, ras, meta }) => {
  const us = unidades(filas);
  const [g] = distribucion(us, () => 'programa');
  const vacio = { ...Object.fromEntries(CLAVES_NIVEL.map((n) => [n, 0])), evaluados: 0, promedio: null,
    pct: Object.fromEntries(CLAVES_NIVEL.map((n) => [n, 0])) };
  const global = resumenGrupo(g ?? vacio, meta);

  const porRAdatos = new Map(distribucion(us, 'ra').map((d) => [d.grupo, d]));
  const porRA = ras.map((r) => ({
    ...resumenGrupo(porRAdatos.get(r.codigo) ?? { ...vacio, grupo: r.codigo }, meta),
    grupo: r.codigo, id_ra: r.id_ra, descripcion: r.descripcion,
  }));
  const codigos = ras.map((r) => r.codigo);
  const porCohorte = filas.length ? evolucion(filas, DIM_COHORTE, codigos, meta) : [];
  const porPeriodo = filas.length ? evolucion(filas, DIM_PERIODO, codigos, meta) : [];
  const porCurso = filas.length ? evolucion(filas, DIM_CATALOGO, codigos, meta) : [];

  return {
    global,
    histograma: histograma(us),
    porRA,
    porCohorte,
    porPeriodo,
    porCurso,
    // Todos los criterios evaluados, del promedio más bajo al más alto.
    criterios: criterios(notas),
  };
};

module.exports = { analizar, histograma, criterios };
