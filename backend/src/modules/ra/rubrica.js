// Reglas de las rúbricas de resultados de aprendizaje (documento RA MaIE, Tablas 5 a 11)
// como funciones puras (sin BD ni Express), para probarlas de forma aislada. Las usan los
// servicios de rúbricas, evaluaciones y reportes; el frontend recibe NIVELES por el API.
//
// Las cuentas se hacen en enteros (centésimas) para que 2,88 × 25 % dé exactamente 0,72 y
// coincida con ROUND(…, 2) de PostgreSQL en la vista v_ra_resultados.

// Niveles de la rúbrica. `nivel` es el valor del enum tipo_nivel_logro de la BD.
const NIVELES = [
  { nivel: 'Alto', etiqueta: 'Alto', min: 4.5, rango: '4.5 – 5.0' },
  { nivel: 'Medio', etiqueta: 'Medio', min: 3.5, rango: '3.5 – 4.4' },
  { nivel: 'Basico', etiqueta: 'Básico', min: 3.0, rango: '3.0 – 3.4' },
  { nivel: 'Insuficiente', etiqueta: 'Insuficiente', min: 0, rango: '< 3.0' },
];
const CLAVES_NIVEL = NIVELES.map((n) => n.nivel);

const NOTA_MIN = 0;
const NOTA_MAX = 5;

// Momentos de análisis (documento RA: «al iniciar el semestre III y finalizar semestre IV»):
// cada momento considera los cursos del catálogo hasta el semestre indicado.
const MOMENTOS = { 'inicio-III': 2, 'fin-IV': 4 };

const centesimas = (x) => Math.round(x * 100);

// Redondeo a 2 decimales, mitad hacia arriba (4.495 → 4.5).
const redondear2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

const esNota = (n) => typeof n === 'number' && Number.isFinite(n) && n >= NOTA_MIN && n <= NOTA_MAX;

const nivelDeNota = (nota) => {
  if (!esNota(nota)) throw new RangeError(`La nota debe ser un número entre ${NOTA_MIN} y ${NOTA_MAX}`);
  const r = redondear2(nota);
  return NIVELES.find((n) => r >= n.min).nivel;
};

// Los pesos de la rúbrica de un RA deben ser positivos y sumar 100; el orden no se repite.
const validarPesos = (criterios) => {
  const errores = [];
  if (!Array.isArray(criterios) || criterios.length === 0) {
    return { valido: false, suma: 0, errores: ['La rúbrica debe tener al menos un criterio'] };
  }
  let sumaCent = 0;
  criterios.forEach((c, i) => {
    const peso = Number(c.peso_porcentaje);
    if (!(peso > 0 && peso <= 100)) errores.push(`El criterio ${i + 1} debe tener un peso entre 0 y 100`);
    else sumaCent += centesimas(peso);
  });
  const ordenes = criterios.map((c) => c.orden);
  if (new Set(ordenes).size !== ordenes.length) errores.push('El orden de los criterios no puede repetirse');
  const suma = sumaCent / 100;
  if (sumaCent !== 10000) errores.push(`Los pesos deben sumar 100 % (suman ${suma} %)`);
  return { valido: errores.length === 0, suma, errores };
};

// `notas` es un objeto o Map { id_criterio: nota }. Si falta algún criterio, total = null.
const totalPonderado = (criterios, notas) => {
  const leer = (id) => (notas instanceof Map ? notas.get(id) : notas?.[id]);
  const faltantes = [];
  let suma = 0; // nota(centésimas) × peso(centésimas)
  for (const c of criterios) {
    const nota = leer(c.id_criterio);
    if (nota === undefined || nota === null) {
      faltantes.push(c.id_criterio);
      continue;
    }
    if (!esNota(nota)) throw new RangeError(`La nota debe ser un número entre ${NOTA_MIN} y ${NOTA_MAX}`);
    suma += centesimas(nota) * centesimas(Number(c.peso_porcentaje));
  }
  const completo = criterios.length > 0 && faltantes.length === 0;
  // suma / 10^6 = Σ nota × peso / 100; se redondea a centésimas, mitad hacia arriba.
  const total = completo ? Math.floor((suma + 5000) / 10000) / 100 : null;
  return { total, completo, faltantes };
};

const resultadoRA = (criterios, notas) => {
  const { total, completo, faltantes } = totalPonderado(criterios, notas);
  return { total, nivel: total === null ? null : nivelDeNota(total), completo, faltantes };
};

// Promedio de varios totales (p. ej. el mismo RA evaluado en dos cursos) y su nivel.
const consolidar = (totales) => {
  const validos = totales.filter((t) => typeof t === 'number' && Number.isFinite(t));
  if (validos.length === 0) return { total: null, nivel: null };
  const promedio = redondear2(validos.reduce((s, t) => s + t, 0) / validos.length);
  return { total: promedio, nivel: nivelDeNota(promedio) };
};

// Agrupa filas con `total` por una clave y devuelve una unidad por grupo con el promedio.
// Sirve para pasar de (oferta, estudiante, RA) a (estudiante, RA) antes de la distribución.
const agruparUnidades = (filas, clave) => {
  const grupos = new Map();
  for (const f of filas) {
    const k = typeof clave === 'function' ? clave(f) : f[clave];
    if (!grupos.has(k)) grupos.set(k, { base: f, totales: [] });
    grupos.get(k).totales.push(f.total);
  }
  return [...grupos.values()].map(({ base, totales }) => ({ ...base, ...consolidar(totales) }));
};

const vacioPorNivel = () => Object.fromEntries(CLAVES_NIVEL.map((n) => [n, 0]));

// Distribución por nivel de las unidades (cada una con `total`) agrupadas por `claveGrupo`.
// Los porcentajes son fracciones (0–1), como espera utils/formato.porcentaje del frontend.
const distribucion = (unidades, claveGrupo) => {
  const grupos = new Map();
  for (const u of unidades) {
    if (u.total === null || u.total === undefined) continue;
    const k = typeof claveGrupo === 'function' ? claveGrupo(u) : u[claveGrupo];
    if (!grupos.has(k)) grupos.set(k, { grupo: k, ...vacioPorNivel(), evaluados: 0, suma: 0 });
    const g = grupos.get(k);
    g[u.nivel ?? nivelDeNota(u.total)] += 1;
    g.evaluados += 1;
    g.suma += u.total;
  }
  return [...grupos.values()].map(({ suma, ...g }) => ({
    ...g,
    pct: Object.fromEntries(CLAVES_NIVEL.map((n) => [n, g[n] / g.evaluados])),
    promedio: redondear2(suma / g.evaluados),
  }));
};

// Validación curricular de un RA: se cumple si el % de evaluados en Alto o Medio alcanza la meta.
const validacion = (fila, metaPct) => {
  if (!fila || !fila.evaluados) return 'Sin datos';
  const logro = centesimas((fila.Alto + fila.Medio) / fila.evaluados * 100);
  return logro >= centesimas(metaPct) ? 'Cumple' : 'En riesgo';
};

const semestreTope = (momento) => {
  if (momento === undefined || momento === null || momento === '' || momento === 'todos') return null;
  if (!(momento in MOMENTOS)) throw new RangeError(`Momento desconocido: ${momento}`);
  return MOMENTOS[momento];
};

module.exports = {
  NIVELES,
  CLAVES_NIVEL,
  MOMENTOS,
  NOTA_MIN,
  NOTA_MAX,
  redondear2,
  nivelDeNota,
  validarPesos,
  totalPonderado,
  resultadoRA,
  consolidar,
  agruparUnidades,
  distribucion,
  validacion,
  semestreTope,
};
