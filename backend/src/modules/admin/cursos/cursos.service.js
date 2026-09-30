// RF-ADM-01 / RF-RA-02 — Catálogo de cursos y ofertas por promoción
// Coordinación crea las ofertas, asigna docentes e inscribe estudiantes de la promoción;
// el docente consulta solo las ofertas que tiene asignadas.
const db = require('../../../config/db');
const ApiError = require('../../../utils/ApiError');
const { ROLES } = require('../../../utils/roles');
const { asegurarAccesoCurso, docenteFiltro } = require('../../ra/propiedad');
const repository = require('./cursos.repository');

const unicos = (lista = []) => [...new Set(lista)];

const validarRol = async (ids, rol, etiqueta) => {
  const invalidos = await repository.noSonDelRol(ids, rol);
  if (invalidos.length) throw ApiError.badRequest(`Hay usuarios que no tienen rol ${etiqueta}`, { ids: invalidos });
};

const detalle = async (id) => ({ ...(await repository.get(id)), estudiantes: await repository.estudiantes(id) });

const guardar = async (id, body) => {
  const clase = await repository.clase(body.id_clase);
  if (!clase) throw ApiError.badRequest('La clase no existe');
  if (!clase.activa && !id) throw ApiError.badRequest('La clase está inactiva; actívela para ofertarla');
  if (id) {
    const actual = await repository.get(id);
    if (!actual) throw ApiError.notFound('Curso no encontrado');
    if (actual.id_catalogo !== clase.id_catalogo && (await repository.contarNotas(id))) {
      throw ApiError.conflict('No se puede cambiar a una clase de otro curso del plan: la oferta ya tiene calificaciones');
    }
  }
  const docentes = unicos(body.docentes);
  await validarRol(docentes, ROLES.DOCENTE, 'docente');
  const idCurso = await db.withTransaction(async (cliente) => {
    let idOferta = id;
    if (id) {
      if (!(await repository.update(cliente, id, body))) throw ApiError.notFound('Curso no encontrado');
    } else {
      idOferta = await repository.create(cliente, body);
    }
    if (body.docentes) await repository.setDocentes(cliente, idOferta, docentes);
    return idOferta;
  });
  return detalle(idCurso);
};

module.exports = {
  catalogo: () => repository.listCatalogo(),

  listar: ({ query, user }) =>
    repository.list({
      cohorte: query.cohorte ?? null,
      periodo: query.periodo ?? null,
      catalogo: query.catalogo ?? null,
      clase: query.clase ?? null,
      // El docente solo ve sus ofertas; Coordinación puede consultar la carga de un docente.
      docente: docenteFiltro(user) ?? query.docente ?? null,
    }),

  async obtener({ params, user }) {
    await asegurarAccesoCurso(user, params.id);
    return detalle(params.id);
  },

  crear: ({ body }) => guardar(null, body),

  actualizar: ({ params, body }) => guardar(params.id, body),

  async eliminar({ params }) {
    if (!(await repository.existe(params.id))) throw ApiError.notFound('Curso no encontrado');
    if (await repository.contarNotas(params.id)) {
      throw ApiError.conflict('No se puede eliminar un curso con calificaciones de rúbrica registradas');
    }
    await repository.remove(params.id);
    return { eliminado: true };
  },

  async asignarDocentes({ params, body }) {
    if (!(await repository.existe(params.id))) throw ApiError.notFound('Curso no encontrado');
    const docentes = unicos(body.docentes);
    await validarRol(docentes, ROLES.DOCENTE, 'docente');
    await db.withTransaction((cliente) => repository.setDocentes(cliente, params.id, docentes));
    return detalle(params.id);
  },

  async inscribir({ params, body }) {
    if (!(await repository.existe(params.id))) throw ApiError.notFound('Curso no encontrado');
    const ids = unicos(body.estudiantes);
    await validarRol(ids, ROLES.ESTUDIANTE, 'estudiante');
    const fuera = await repository.fueraDeCohorte(params.id, ids);
    if (fuera.length) throw ApiError.badRequest('Hay estudiantes que no pertenecen a la promoción del curso', { ids: fuera });
    await db.withTransaction((cliente) => repository.setEstudiantes(cliente, params.id, ids));
    return detalle(params.id);
  },

  async matricularCohorte({ params }) {
    if (!(await repository.existe(params.id))) throw ApiError.notFound('Curso no encontrado');
    const agregados = await repository.matricularCohorte(params.id);
    return { agregados, curso: await detalle(params.id) };
  },
};
