// RF-EVAL-01 — Diligenciamiento de los formularios EE, EC y AE del Acuerdo 058.
// Quién puede diligenciar qué lo decide categorizacion.js (funciones puras); aquí solo se arma el
// contexto, se valida el formulario completo y se guarda. El EE es anónimo: la constancia (estudiante,
// docente, semestre) y la respuesta (sin evaluador) se guardan por separado.
const ApiError = require('../../../utils/ApiError');
const { ROLES } = require('../../../utils/roles');
const repository = require('../evalDocente.repository');
const { actorDe, contextoPeriodo } = require('../contexto');
const { autorizar, pendientesDe, recibeRespuestas } = require('../categorizacion');
const { VALORES, ETIQUETAS_VALOR } = require('../acuerdo058');
const { huella } = require('../anonimato');
const env = require('../../../config/env');

// Huella de la constancia de un EE (sin identificadores en claro).
const huellaEE = (periodo, idEstudiante, idDocente) => huella(env.evalSecreto, periodo, idEstudiante, idDocente);

// Docentes que el estudiante ya evaluó en el semestre, entre los que tiene asignados.
const evaluadosPor = async (periodo, idEstudiante, asignaciones) => {
  const porHuella = new Map(asignaciones.map((a) => [huellaEE(periodo, idEstudiante, a.id_docente), a.id_docente]));
  const hechas = await repository.constanciasDe(periodo, [...porHuella.keys()]);
  return new Set([...hechas].map((h) => porHuella.get(h)));
};

const LONGITUD_COMENTARIO = 2000;

// Instrumento agrupado por característica (para pintar el formulario).
const instrumento = async (tipo) => {
  const preguntas = await repository.preguntas(tipo);
  const caracteristicas = [];
  for (const p of preguntas) {
    let c = caracteristicas.find((x) => x.caracteristica === p.caracteristica);
    if (!c) {
      c = { caracteristica: p.caracteristica, nombre: p.nombre_caracteristica, cuenta_docente: p.caracteristica !== 0, preguntas: [] };
      caracteristicas.push(c);
    }
    c.preguntas.push({ id_pregunta: p.id_pregunta, codigo: p.codigo, texto: p.texto, escala: p.escala });
  }
  return { tipo, valores: VALORES.map((v) => ({ valor: v, etiqueta: ETIQUETAS_VALOR[v] })), caracteristicas, preguntas };
};

// Todas las preguntas activas respondidas con un valor válido, y ninguna ajena al formulario.
const validarItems = (preguntas, items) => {
  if (!items || typeof items !== 'object' || Array.isArray(items)) throw ApiError.badRequest('Envíe las respuestas como { id_pregunta: valor }');
  const ids = new Set(preguntas.map((p) => String(p.id_pregunta)));
  const ajenas = Object.keys(items).filter((k) => !ids.has(k));
  if (ajenas.length) throw ApiError.badRequest('Hay respuestas a preguntas que no son de este formulario', ajenas);
  const faltan = preguntas.filter((p) => !(String(p.id_pregunta) in items)).map((p) => p.codigo);
  if (faltan.length) throw ApiError.badRequest(`Faltan ${faltan.length} pregunta(s) por responder`, faltan);
  const invalidas = Object.entries(items).filter(([, v]) => !VALORES.includes(v)).map(([k]) => k);
  if (invalidas.length) throw ApiError.badRequest(`Valoración inválida (use ${VALORES.join(', ')})`, invalidas);
};

const periodoAbierto = async (periodo) => {
  const config = await repository.periodo(periodo);
  const estado = recibeRespuestas(config);
  if (!estado.abierta) throw ApiError.conflict(estado.motivo);
  return config;
};

module.exports = {
  // GET /eval-docente/formularios/:tipo
  formulario: async ({ params }) => {
    const { preguntas, ...resto } = await instrumento(params.tipo);
    return resto;
  },

  // GET /eval-docente/pendientes — formularios que le corresponden al usuario en los semestres habilitados.
  async pendientes({ user }) {
    const actor = await actorDe(user);
    const configs = (await repository.periodos()).filter((p) => p.habilitada);
    return Promise.all(configs.map(async (config) => {
      const esEstudiante = user.rol === ROLES.ESTUDIANTE;
      const ctx = await contextoPeriodo(config.periodo, config, { idEstudiante: esEstudiante ? user.id : null });
      const asignaciones = ctx.asignaciones.get(user.id) ?? [];
      const hechas = esEstudiante
        ? { ee: await evaluadosPor(config.periodo, user.id, asignaciones) }
        : { ecAe: await repository.ecAeHechas(config.periodo) };
      const formularios = pendientesDe(actor, { unidades: ctx.unidades, asignaciones }, hechas)
        .map(({ id_usuario_docente, cohorte_inicio, ...f }) => f);
      return {
        periodo: config.periodo, fecha_apertura: config.fecha_apertura, fecha_cierre: config.fecha_cierre,
        ...recibeRespuestas(config), formularios,
      };
    }));
  },

  // POST /eval-docente/respuestas — { periodo, tipo, id_docente, id_cohorte?, respuestas, comentario? }
  async registrar({ body, user }) {
    const config = await periodoAbierto(body.periodo);
    const actor = await actorDe(user);
    const esEE = body.tipo === 'EE';
    const ctx = await contextoPeriodo(body.periodo, config, { idEstudiante: esEE ? user.id : null });
    const decision = autorizar(actor, body.tipo, { id_docente: body.id_docente, id_cohorte: body.id_cohorte },
      { unidades: ctx.unidades, asignaciones: ctx.asignaciones.get(user.id) ?? [] });
    if (!decision.permitido) throw ApiError.forbidden(decision.motivo);

    const preguntas = await repository.preguntas(body.tipo);
    validarItems(preguntas, body.respuestas);
    const comentario = body.comentario?.trim() ? body.comentario.trim().slice(0, LONGITUD_COMENTARIO) : null;

    if (esEE) {
      try {
        await repository.guardarEE(body.periodo, {
          huella: huellaEE(body.periodo, user.id, body.id_docente), idDocente: body.id_docente, idCohorte: decision.id_cohorte,
          poblacion: decision.poblacion, comentario, items: body.respuestas,
        });
      } catch (err) {
        if (err.code === '23505') throw ApiError.conflict('Ya evaluó a este docente en el semestre');
        throw err;
      }
      // Nada que identifique la respuesta: solo la confirmación.
      return { registrada: true, tipo: 'EE' };
    }
    await repository.guardarNominal(body.periodo, body.tipo, {
      idEvaluador: user.id, idDocente: body.id_docente, idCohorte: decision.id_cohorte, comentario, items: body.respuestas,
    });
    return { registrada: true, tipo: body.tipo, id_docente: body.id_docente, id_cohorte: decision.id_cohorte };
  },

  // GET /eval-docente/respuestas/propia?periodo&tipo&id_docente&id_cohorte — EC o AE ya guardada (el EE no
  // se puede consultar: es anónimo).
  async propia({ query, user }) {
    const config = await repository.periodo(query.periodo);
    const actor = await actorDe(user);
    const ctx = await contextoPeriodo(query.periodo, config);
    const decision = autorizar(actor, query.tipo, { id_docente: query.id_docente, id_cohorte: query.id_cohorte }, { unidades: ctx.unidades });
    if (!decision.permitido) throw ApiError.forbidden(decision.motivo);
    return repository.nominal(query.periodo, query.tipo, query.id_docente, query.id_cohorte);
  },

  instrumento,
  huellaEE,
};
