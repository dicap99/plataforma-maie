// RF-EVAL-01/05 — Habilitación de la evaluación docente por semestre académico (dentro del Módulo 3,
// separada de la apertura de rúbricas del Módulo 2), cronograma (Art. 10), opciones de cálculo y
// publicación de resultados a los docentes.
const ApiError = require('../../../utils/ApiError');
const repository = require('../evalDocente.repository');
const { contextoPeriodo } = require('../contexto');
const { recibeRespuestas } = require('../categorizacion');
const { huella } = require('../anonimato');
const env = require('../../../config/env');

// Avance de diligenciamiento de un semestre (sin cruzar constancias con respuestas: anonimato).
const resumen = async (periodo, config) => {
  const ctx = await contextoPeriodo(periodo, config);
  const [avance, hechas] = await Promise.all([repository.avance(periodo), repository.ecAeHechas(periodo)]);
  const asignaciones = [...ctx.asignaciones.values()].flat();
  const contar = (pob) => asignaciones.filter((a) => a.poblacion === pob).length;
  const estudiantes = (pob) => [...ctx.asignaciones.values()].filter((l) => l.some((a) => a.poblacion === pob)).length;
  const ee = (pob) => avance.ee.filter((r) => r.poblacion === pob).reduce((s, r) => s + r.n, 0);
  const conCuenta = ctx.unidades.filter((u) => u.id_usuario_docente);
  const posEsperadas = contar('posgrado');
  const preEsperadas = contar('pregrado');
  const posRecibidas = ee('posgrado');
  const preRecibidas = ee('pregrado');
  const estudiantesAlDia = [...ctx.asignaciones.entries()]
    .filter(([id, lista]) => lista.every((a) => avance.constancias.has(huella(env.evalSecreto, periodo, id, a.id_docente)))).length;
  const ecPendientes = ctx.unidades
    .filter((u) => !hechas.has(`EC|${u.id_docente}|${u.id_cohorte}`))
    .map((u) => ({ id_docente: u.id_docente, docente: u.docente, id_cohorte: u.id_cohorte, cohorte: u.cohorte }));
  const aePendientes = ctx.unidades
    .filter((u) => !u.id_usuario_docente || !hechas.has(`AE|${u.id_docente}|${u.id_cohorte}`))
    .map((u) => ({
      id_docente: u.id_docente,
      docente: u.docente,
      id_cohorte: u.id_cohorte,
      cohorte: u.cohorte,
      sin_cuenta: !u.id_usuario_docente,
    }));
  return {
    unidades: ctx.unidades.length,
    docentes: new Set(ctx.unidades.map((u) => u.id_docente)).size,
    ofertas_sin_docente: ctx.ofertas.filter((o) => !o.docentes.length).length,
    ee: {
      posgrado: { estudiantes: estudiantes('posgrado'), esperadas: posEsperadas, recibidas: posRecibidas },
      pregrado: { estudiantes: estudiantes('pregrado'), esperadas: preEsperadas, recibidas: preRecibidas },
      estudiantes_al_dia: estudiantesAlDia,
    },
    ec: { esperadas: ctx.unidades.length, recibidas: ctx.unidades.length - ecPendientes.length },
    ae: {
      esperadas: conCuenta.length,
      recibidas: conCuenta.filter((u) => hechas.has(`AE|${u.id_docente}|${u.id_cohorte}`)).length,
      sin_cuenta: ctx.unidades.length - conCuenta.length,
    },
    faltantes: {
      ee: {
        estudiantes_pendientes: Math.max(0, ctx.asignaciones.size - estudiantesAlDia),
        respuestas_posgrado: Math.max(0, posEsperadas - posRecibidas),
        respuestas_pregrado: Math.max(0, preEsperadas - preRecibidas),
      },
      ec: ecPendientes,
      ae: aePendientes,
    },
  };
};

const SIN_CONFIGURAR = {
  habilitada: false, incluye_pregrado: false, fecha_apertura: null, fecha_cierre: null, excluir_extremas: false,
  publicado: false, publicado_en: null, actualizado_en: null,
};

const conEstado = (p) => ({ ...p, ...recibeRespuestas(p.actualizado_en ? p : null) });

module.exports = {
  async listar() {
    const [semestres, configs] = await Promise.all([repository.semestresConOfertas(), repository.periodos()]);
    return Promise.all(semestres.map(async (s) => {
      const config = configs.find((c) => c.periodo === s) ?? { ...SIN_CONFIGURAR, periodo: s };
      return { ...conEstado(config), avance: await resumen(s, config) };
    }));
  },

  async obtener({ params }) {
    const config = (await repository.periodo(params.periodo)) ?? { ...SIN_CONFIGURAR, periodo: params.periodo };
    return { ...conEstado(config), avance: await resumen(params.periodo, config) };
  },

  // PUT /periodos/:periodo — habilitación, cronograma y opciones de cálculo.
  async cambiar({ params, body, user }) {
    const actual = await repository.periodo(params.periodo);
    if (actual?.publicado) {
      throw ApiError.conflict('Los resultados del semestre están publicados: retire la publicación antes de cambiar la configuración');
    }
    const apertura = body.fecha_apertura !== undefined ? body.fecha_apertura : actual?.fecha_apertura;
    const cierre = body.fecha_cierre !== undefined ? body.fecha_cierre : actual?.fecha_cierre;
    if (apertura && cierre && String(cierre).slice(0, 10) < String(apertura).slice(0, 10)) {
      throw ApiError.badRequest('La fecha de cierre debe ser posterior a la de apertura');
    }
    const { publicado, ...datos } = body;
    const guardado = await repository.guardarPeriodo(params.periodo, datos, user.id);
    // Al cerrar, las respuestas EE se reescriben en orden aleatorio (anonimato.js).
    if (actual?.habilitada && datos.habilitada === false) await repository.barajarEE(params.periodo);
    return conEstado(guardado);
  },

  // POST /periodos/:periodo/publicacion — { publicado }. Publicar exige la evaluación cerrada y con respuestas.
  async publicar({ params, body, user }) {
    const actual = await repository.periodo(params.periodo);
    if (!actual) throw ApiError.notFound('El semestre no tiene evaluación docente');
    if (body.publicado) {
      if (actual.habilitada) throw ApiError.conflict('Cierre la evaluación (deshabilítela) antes de publicar los resultados');
      if (!(await repository.tieneRespuestas(params.periodo))) throw ApiError.conflict('El semestre no tiene respuestas para publicar');
      // Por si el semestre se cerró por fechas sin pasar por «cerrar»: se baraja antes de publicar.
      await repository.barajarEE(params.periodo);
    }
    return conEstado(await repository.guardarPeriodo(params.periodo, { publicado: body.publicado }, user.id));
  },
};
