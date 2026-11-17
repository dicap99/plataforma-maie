// Reglas de cálculo del Acuerdo 058 de 2022 (Comité Curricular y de Investigaciones MaIE) como funciones
// puras, sin BD ni Express, para verificarlas contra el texto del Acuerdo y contra el libro
// «Estadísticas Evaluación Docente MaIE.xlsx» de Coordinación.
//
// Decisiones del usuario (2026-11-16), donde el Excel de Coordinación calcula distinto del Acuerdo:
//  1. %IP: OFICIAL = Acuerdo (repeticiones reales de MA/A/I/MI; de él sale la categoría oficial). Como
//     referencia se calcula también el «método del Excel de Coordinación (referencia histórica)»: cuenta en
//     cuántas PREGUNTAS aparece cada valoración (COUNTIF(>0)), con su diferencia frente al oficial.
//     Funciones separadas: `indicadores` (oficial) e `indicadoresExcel` (referencia).
//  2. IDST-D de las dos formas, lado a lado: por variable (Parágrafo 1 del Acuerdo) y por característica
//     (C1–C6 en GF o F / 6, como el Excel). IDSC-Prom/Prog con la definición del Acuerdo (docentes con GF o
//     F en la característica / total de docentes) y, como referencia, lo que hace el Excel (promedio del %IP
//     por característica e IDST-P = promedio de IDST-D).
//  3. EE, EC y AE por separado: el Acuerdo NO define pesos para combinarlos; no hay resultado combinado.

// Art. 1: escala cualitativa. NA = No aplica / No responde (no entra en IP ni en IN).
const VALORES = ['MA', 'A', 'I', 'MI', 'NA'];
const ETIQUETAS_VALOR = { MA: 'Muy adecuada', A: 'Adecuada', I: 'Inadecuada', MI: 'Muy inadecuada', NA: 'No aplica / No responde' };

// Considerandos: IP = 1,5·MA + A; IN = 1,5·MI + I.
const PESOS = Object.freeze({ MA: 1.5, A: 1, I: 1, MI: 1.5 });

// Art. 2 y considerandos: categorías del %IP. Límites inferiores inclusivos y SIN redondeo previo, como
// compara el Excel (>=80 GF, >=60 F, >=40 T, >=20 D, si no GD): así no queda hueco entre 79,9 y 80,0
// (79,95 → Fortaleza; 80 → Gran Fortaleza).
const CATEGORIAS = [
  { sigla: 'GF', nombre: 'Gran Fortaleza', min: 80, rango: '80,0 – 100,0 %' },
  { sigla: 'F', nombre: 'Fortaleza', min: 60, rango: '60,0 – 79,9 %' },
  { sigla: 'T', nombre: 'Transición', min: 40, rango: '40,0 – 59,9 %' },
  { sigla: 'D', nombre: 'Debilidad', min: 20, rango: '20,0 – 39,9 %' },
  { sigla: 'GD', nombre: 'Gran Debilidad', min: 0, rango: '0,0 – 19,9 %' },
];
// Parágrafo 1: «desempeño satisfactorio» = Gran Fortaleza o Fortaleza.
const SATISFACTORIAS = new Set(['GF', 'F']);

// Meta del indicador (Indicador_Docentes_Evaluados_MaIE.docx, numeral 11): 90 % de docentes con GF y F.
const META_PCT = 90;

// Parágrafo 2 del Art. 12: umbral de estudiantes para considerar excluir valoraciones extremas.
const UMBRAL_EXTREMAS = 10;

// Característica 0 del EE («Autoevaluación del estudiante»): evalúa al estudiante, no al docente; el
// Excel la calcula pero la excluye del resumen C1–C6 y del IDST-D.
const cuentaParaDocente = (caracteristica) => caracteristica !== 0;

const categoria = (pctIp) => {
  if (pctIp === null || pctIp === undefined) return null;
  if (typeof pctIp !== 'number' || Number.isNaN(pctIp) || pctIp < 0 || pctIp > 100) {
    throw new RangeError('%IP debe ser un número entre 0 y 100');
  }
  return CATEGORIAS.find((c) => pctIp >= c.min);
};

// Nombre de la categoría (RF-EVAL-03).
const categorizar = (pctIp) => {
  if (pctIp === null || pctIp === undefined) throw new RangeError('%IP debe ser un número entre 0 y 100');
  return categoria(pctIp).nombre;
};

const conteoVacio = () => ({ MA: 0, A: 0, I: 0, MI: 0, NA: 0 });

// Repeticiones de cada valoración en una lista de valores ('MA', 'A'…).
const contar = (valores) => {
  const c = conteoVacio();
  for (const v of valores) {
    if (!(v in c)) throw new RangeError(`Valoración desconocida: ${v}`);
    c[v] += 1;
  }
  return c;
};

const sumarConteos = (lista) => lista.reduce((t, c) => {
  for (const v of VALORES) t[v] += c[v] ?? 0;
  return t;
}, conteoVacio());

// RF-EVAL-02: IP, IN, %IP y %IN a partir de las repeticiones (o de cualquier magnitud proporcional a
// ellas, p. ej. los porcentajes por pregunta de Google Forms: el %IP no cambia de escala).
// Sin valoraciones MA/A/I/MI (todo NA) el %IP no está definido: null y sin categoría.
const indicadores = (conteos) => {
  const ma = conteos.MA ?? 0;
  const a = conteos.A ?? 0;
  const i = conteos.I ?? 0;
  const mi = conteos.MI ?? 0;
  for (const x of [ma, a, i, mi]) {
    if (typeof x !== 'number' || Number.isNaN(x) || x < 0) throw new RangeError('Las frecuencias deben ser números no negativos');
  }
  const ip = PESOS.MA * ma + PESOS.A * a;
  const inn = PESOS.MI * mi + PESOS.I * i;
  const total = ip + inn;
  const pctIp = total > 0 ? (ip / total) * 100 : null;
  const cat = categoria(pctIp);
  return {
    ip,
    in: inn,
    pct_ip: pctIp,
    pct_in: total > 0 ? (inn / total) * 100 : null,
    categoria: cat?.nombre ?? null,
    sigla: cat?.sigla ?? null,
  };
};

// Método del Excel de Coordinación (referencia histórica, no normativo): «Ocurrencias» =
// COUNTIF(porcentajes de las preguntas de la característica, ">0"), es decir, en cuántas preguntas
// aparece cada valoración. `filas`: una por pregunta, con porcentajes o repeticiones ({ MA, A, I, MI, NA }).
const conteoCountifExcel = (filas) => {
  const c = conteoVacio();
  for (const f of filas) for (const v of VALORES) if ((f[v] ?? 0) > 0) c[v] += 1;
  return c;
};

// %IP y categoría con el método del Excel (mismas fórmulas de IP/IN sobre las «Ocurrencias»).
const indicadoresExcel = (filas) => {
  const ocurrencias = conteoCountifExcel(filas);
  return { ocurrencias, ...indicadores(ocurrencias) };
};

// Parágrafo 2: una respuesta es extrema si TODAS las variables del docente valen MA (o todas MI).
const valoracionExtrema = (items, idsPreguntasDocente) => {
  if (!idsPreguntasDocente.length) return null;
  const valores = idsPreguntasDocente.map((id) => items[id]);
  if (valores.every((v) => v === 'MA')) return 'MA';
  if (valores.every((v) => v === 'MI')) return 'MI';
  return null;
};

// Aplica la opción del Parágrafo 2 («se considerará eliminar»): solo si Coordinación la activa y la unidad
// tiene más de 10 respuestas de estudiantes. Devuelve las incluidas y cuántas se excluyeron.
const filtrarExtremas = (respuestas, idsPreguntasDocente, { activa, umbral = UMBRAL_EXTREMAS }) => {
  if (!activa || respuestas.length <= umbral) return { incluidas: respuestas, excluidas: 0 };
  const incluidas = respuestas.filter((r) => !valoracionExtrema(r.items, idsPreguntasDocente));
  return { incluidas, excluidas: respuestas.length - incluidas.length };
};

const GRANULARIDADES = ['variable', 'caracteristica'];

// IDST-D (Parágrafo 1): proporción (0–1) de calificaciones GF o F sobre el total de calificaciones del
// docente. 'variable' = cada pregunta es una calificación (Acuerdo); 'caracteristica' = cada C1–C6 (Excel).
// Solo cuentan las calificaciones con %IP definido y de características del docente (sin la 0).
const idstD = ({ variables, caracteristicas }, granularidad = 'variable') => {
  if (!GRANULARIDADES.includes(granularidad)) throw new RangeError(`Granularidad desconocida: ${granularidad}`);
  const base = (granularidad === 'variable' ? variables : caracteristicas)
    .filter((x) => x.cuenta_docente && x.sigla);
  const satisfactorias = base.filter((x) => SATISFACTORIAS.has(x.sigla)).length;
  return { granularidad, satisfactorias, total: base.length, valor: base.length ? satisfactorias / base.length : null };
};

// Resumen estadístico del Art. 12 («mejores y peores calificaciones, valores promedio, desviaciones»)
// sobre los %IP de un conjunto de calificaciones [{ codigo, pct_ip }]. Desviación estándar poblacional.
const resumenEstadistico = (items) => {
  const v = items.filter((x) => x.pct_ip !== null && x.pct_ip !== undefined);
  if (!v.length) return { n: 0, promedio: null, desviacion: null, mejor: null, peor: null };
  const media = v.reduce((s, x) => s + x.pct_ip, 0) / v.length;
  const desviacion = Math.sqrt(v.reduce((s, x) => s + (x.pct_ip - media) ** 2, 0) / v.length);
  const mejor = v.reduce((a, b) => (b.pct_ip > a.pct_ip ? b : a));
  const peor = v.reduce((a, b) => (b.pct_ip < a.pct_ip ? b : a));
  return { n: v.length, promedio: media, desviacion, mejor: { codigo: mejor.codigo, pct_ip: mejor.pct_ip }, peor: { codigo: peor.codigo, pct_ip: peor.pct_ip } };
};

// Resultado de un formulario (EE, EC o AE) para una unidad evaluada (docente en una promoción y semestre).
// preguntas: [{ id_pregunta, caracteristica, nombre_caracteristica, codigo, orden, texto }] del formulario.
// respuestas: [{ items: { [id_pregunta]: 'MA'|'A'|'I'|'MI'|'NA' }, comentario?, poblacion? }].
// Cada característica trae el %IP OFICIAL (Acuerdo) y, en `excel`, el del método del Excel de Coordinación
// (referencia histórica) con su diferencia. El IDST-D se entrega por variable y por característica (con la
// categoría oficial) y, como referencia, por característica con el método del Excel.
const resultadoFormulario = (preguntas, respuestas, { excluirExtremas = false } = {}) => {
  const ordenadas = [...preguntas].sort((a, b) => a.orden - b.orden);
  const idsDocente = ordenadas.filter((p) => cuentaParaDocente(p.caracteristica)).map((p) => p.id_pregunta);
  const { incluidas, excluidas } = filtrarExtremas(respuestas, idsDocente, { activa: excluirExtremas });

  const variables = ordenadas.map((p) => {
    const conteos = contar(incluidas.map((r) => r.items[p.id_pregunta]).filter(Boolean));
    return {
      id_pregunta: p.id_pregunta, codigo: p.codigo, texto: p.texto, caracteristica: p.caracteristica,
      cuenta_docente: cuentaParaDocente(p.caracteristica), conteos, ...indicadores(conteos),
    };
  });

  const caracteristicas = [];
  for (const v of variables) {
    let c = caracteristicas.find((x) => x.caracteristica === v.caracteristica);
    if (!c) {
      const p = ordenadas.find((x) => x.caracteristica === v.caracteristica);
      c = { caracteristica: v.caracteristica, nombre: p.nombre_caracteristica, cuenta_docente: v.cuenta_docente, variables: 0, partes: [] };
      caracteristicas.push(c);
    }
    c.variables += 1;
    c.partes.push(v.conteos);
  }
  const porCaracteristica = caracteristicas.map(({ partes, ...c }) => {
    const conteos = sumarConteos(partes);
    const oficial = indicadores(conteos);
    const ref = indicadoresExcel(partes);
    return {
      ...c, conteos, ...oficial,
      excel: {
        ocurrencias: ref.ocurrencias, pct_ip: ref.pct_ip, categoria: ref.categoria, sigla: ref.sigla,
        diferencia: oficial.pct_ip !== null && ref.pct_ip !== null ? ref.pct_ip - oficial.pct_ip : null,
      },
    };
  });

  // Indicador global del docente en el formulario (todas sus variables, sin la característica 0).
  const global = indicadores(sumarConteos(variables.filter((v) => v.cuenta_docente).map((v) => v.conteos)));

  return {
    respuestas: incluidas.length,
    excluidas,
    caracteristicas: porCaracteristica,
    variables,
    global,
    estadistica: resumenEstadistico(variables.filter((v) => v.cuenta_docente)),
    idst_d: {
      por_variable: idstD({ variables, caracteristicas: porCaracteristica }, 'variable'),
      por_caracteristica: idstD({ variables, caracteristicas: porCaracteristica }, 'caracteristica'),
      excel: idstD({ variables: [], caracteristicas: porCaracteristica.map((c) => ({ ...c, ...c.excel })) }, 'caracteristica'),
    },
    comentarios: incluidas.map((r) => r.comentario?.trim()).filter(Boolean),
  };
};

// IDSC (Parágrafo 1): por característica, docentes con GF o F sobre el total de docentes con calificación
// en esa característica. `docentes`: [{ caracteristicas: [{ caracteristica, nombre, sigla, cuenta_docente }] }].
const idsc = (docentes) => {
  const mapa = new Map();
  for (const d of docentes) {
    for (const c of d.caracteristicas) {
      if (!c.cuenta_docente || !c.sigla) continue;
      if (!mapa.has(c.caracteristica)) mapa.set(c.caracteristica, { caracteristica: c.caracteristica, nombre: c.nombre, docentes: 0, satisfactorios: 0 });
      const x = mapa.get(c.caracteristica);
      x.docentes += 1;
      if (SATISFACTORIAS.has(c.sigla)) x.satisfactorios += 1;
    }
  }
  return [...mapa.values()]
    .sort((a, b) => a.caracteristica - b.caracteristica)
    .map((x) => ({ ...x, valor: x.satisfactorios / x.docentes }));
};

// Promedio del %IP por característica entre docentes (fila «promedio» de cada promoción en el Excel y
// tabla 22 del Indicador_Docentes_Evaluados_MaIE.docx).
const promedioIpPorCaracteristica = (docentes) => {
  const mapa = new Map();
  for (const d of docentes) {
    for (const c of d.caracteristicas) {
      if (!c.cuenta_docente || c.pct_ip === null) continue;
      if (!mapa.has(c.caracteristica)) mapa.set(c.caracteristica, { caracteristica: c.caracteristica, nombre: c.nombre, suma: 0, n: 0 });
      const x = mapa.get(c.caracteristica);
      x.suma += c.pct_ip;
      x.n += 1;
    }
  }
  return [...mapa.values()]
    .sort((a, b) => a.caracteristica - b.caracteristica)
    .map(({ suma, n, ...x }) => ({ ...x, docentes: n, promedio: suma / n }));
};

const promedio = (xs) => {
  const v = xs.filter((x) => x !== null && x !== undefined);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

// IDST-P (Indicador_Docentes_Evaluados_MaIE.docx, numeral 14): promedio de los IDST-D de la promoción.
// El del semestre es el promedio de las promociones (hoja IDST-P del Excel, «Promedio promociones»).
const idstP = (idstDs) => promedio(idstDs);

module.exports = {
  VALORES,
  ETIQUETAS_VALOR,
  PESOS,
  CATEGORIAS,
  SATISFACTORIAS,
  META_PCT,
  UMBRAL_EXTREMAS,
  GRANULARIDADES,
  cuentaParaDocente,
  categoria,
  categorizar,
  contar,
  sumarConteos,
  indicadores,
  conteoCountifExcel,
  indicadoresExcel,
  valoracionExtrema,
  filtrarExtremas,
  idstD,
  resumenEstadistico,
  resultadoFormulario,
  idsc,
  promedioIpPorCaracteristica,
  promedio,
  idstP,
};
