// RF-EVAL-02 a RF-EVAL-05 — Resultados de la evaluación docente.
// Coordinación: consolidado del semestre (por docente, promoción y programa), histórico e informes.
// Docente: solo sus propios resultados y solo de semestres publicados (RF-EVAL-05).
// Nunca se expone quién respondió un EE: las respuestas no guardan evaluador.
const ApiError = require('../../../utils/ApiError');
const repository = require('../evalDocente.repository');
const { unidadesDelPeriodo } = require('../categorizacion');
const { consolidar } = require('./consolidado');
const informes = require('./informes');

const clave = (u) => `${u.id_docente}|${u.id_cohorte}`;

// Unidades del semestre: las de la asignación vigente más las que solo aparecen en respuestas.
const unidadesDe = (ofertas, extra) => {
  const mapa = new Map(unidadesDelPeriodo(ofertas).map((u) => [clave(u), u]));
  for (const e of extra) if (!mapa.has(clave(e))) mapa.set(clave(e), { ...e, cursos: [] });
  return [...mapa.values()];
};

const consolidadoPeriodo = async (config, poblacion = 'todas') => {
  const [ofertas, extra, preguntas, respuestas] = await Promise.all([
    repository.ofertas(config.periodo),
    repository.unidadesConRespuestas({ periodo: config.periodo }),
    repository.preguntasDelPeriodo(config.periodo),
    repository.respuestas({ periodo: config.periodo }),
  ]);
  return consolidar({ preguntas, unidades: unidadesDe(ofertas, extra), respuestas, config, poblacion });
};

const periodoOError = async (periodo) => {
  const config = await repository.periodo(periodo);
  if (!config) throw ApiError.notFound('El semestre no tiene evaluación docente');
  return config;
};

// Serie histórica del programa: un punto por semestre con respuestas (variaciones históricas, Art. 12).
const historico = async (poblacion, { soloPublicados = false } = {}) => {
  const configs = (await repository.periodos()).filter((p) => !soloPublicados || p.publicado).reverse();
  const puntos = await Promise.all(configs.map(async (config) => {
    const c = await consolidadoPeriodo(config, poblacion);
    if (!c.programa.respuestas_ee) return null;
    return { periodo: config.periodo, publicado: config.publicado, promociones: c.promociones.length, ...c.programa };
  }));
  return puntos.filter(Boolean);
};

// Resultados de un docente en cada semestre (los propios, o los que consulta Coordinación).
const resultadosDocente = async (idDocente, { soloPublicados }) => {
  const perfil = await repository.perfilDocente(idDocente);
  if (!perfil) throw ApiError.notFound('Docente no encontrado');
  const configs = (await repository.periodos()).filter((p) => !soloPublicados || p.publicado);
  const periodos = [];
  for (const config of configs.reverse()) {
    const c = await consolidadoPeriodo(config);
    const propias = c.unidades.filter((u) => u.id_docente === idDocente && (u.ee || u.ec || u.ae));
    if (propias.length) {
      periodos.push({
        periodo: config.periodo, publicado: config.publicado, publicado_en: config.publicado_en,
        excluir_extremas: config.excluir_extremas,
        unidades: propias.map(({ id_usuario_docente, ...u }) => u),
      });
    }
  }
  return { docente: perfil, periodos };
};

module.exports = {
  consolidadoPeriodo,
  historico,
  resultadosDocente,

  // GET /eval-docente/resultados?periodo&poblacion
  async consolidado({ query }) {
    const config = await periodoOError(query.periodo);
    const poblacion = query.poblacion ?? 'todas';
    const [c, serie] = await Promise.all([consolidadoPeriodo(config, poblacion), historico(poblacion)]);
    return { periodo: config, ...c, historico: serie };
  },

  // GET /eval-docente/resultados/me — solo semestres publicados.
  async propios({ user }) {
    const idDocente = await repository.docentePropio(user.id);
    if (!idDocente) throw ApiError.notFound('Su cuenta no está vinculada a un perfil docente');
    return resultadosDocente(idDocente, { soloPublicados: true });
  },

  // GET /eval-docente/resultados/docentes/:idDocente (Coordinación)
  porDocente: ({ params }) => resultadosDocente(params.idDocente, { soloPublicados: false }),

  // GET /eval-docente/resultados/exportar?periodo&poblacion — libro Excel con el formato de Coordinación.
  async exportar({ query }) {
    const config = await periodoOError(query.periodo);
    const poblacion = query.poblacion ?? 'todas';
    const [c, serie] = await Promise.all([consolidadoPeriodo(config, poblacion), historico(poblacion)]);
    return informes.excel({ config, consolidado: c, historico: serie, poblacion });
  },

  // GET /eval-docente/resultados/informe.pdf?periodo&poblacion — informe consolidado con gráficas.
  async informePdf({ query }) {
    const config = await periodoOError(query.periodo);
    const poblacion = query.poblacion ?? 'todas';
    const [c, serie] = await Promise.all([consolidadoPeriodo(config, poblacion), historico(poblacion)]);
    return informes.pdfConsolidado({ config, consolidado: c, historico: serie, poblacion });
  },

  // GET /eval-docente/resultados/docentes/:idDocente/informe.pdf (Coordinación)
  async informeDocentePdf({ params }) {
    return informes.pdfDocente(await resultadosDocente(params.idDocente, { soloPublicados: false }));
  },

  // GET /eval-docente/resultados/me/informe.pdf (docente, solo publicados)
  async informePropioPdf({ user }) {
    const idDocente = await repository.docentePropio(user.id);
    if (!idDocente) throw ApiError.notFound('Su cuenta no está vinculada a un perfil docente');
    return informes.pdfDocente(await resultadosDocente(idDocente, { soloPublicados: true }));
  },
};
