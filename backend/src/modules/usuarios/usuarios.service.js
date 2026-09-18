// RNF-SEG-01 — Gestión de usuarios y roles (RBAC)
const bcrypt = require('bcryptjs');
const env = require('../../config/env');
const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const { ROLES } = require('../../utils/roles');
const repository = require('./usuarios.repository');

const noEncontrado = () => ApiError.notFound('Usuario no encontrado');

// Crea/actualiza el usuario y su vínculo con el perfil docente en una sola transacción.
const guardar = async (id, body) => {
  const datos = { ...body };
  if (body.password) datos.password_hash = await bcrypt.hash(body.password, env.bcryptCost);
  if (body.id_docente && body.rol !== ROLES.DOCENTE) {
    throw ApiError.badRequest('Solo un usuario con rol docente puede vincularse a un perfil docente');
  }
  return db.withTransaction(async (cliente) => {
    let idUsuario = id;
    if (id) {
      const { rowCount } = await repository.update(cliente, id, datos);
      if (!rowCount) throw noEncontrado();
    } else {
      idUsuario = (await repository.create(cliente, datos)).rows[0].id_usuario;
    }
    if (body.id_docente !== undefined) {
      const vinculados = await repository.vincularDocente(cliente, idUsuario, body.id_docente);
      if (body.id_docente && !vinculados) throw ApiError.badRequest('El perfil docente indicado no existe');
    }
    return idUsuario;
  });
};

module.exports = {
  listar: () => repository.list(),

  async obtener({ params }) {
    const usuario = await repository.get(params.id);
    if (!usuario) throw noEncontrado();
    return usuario;
  },

  async crear({ body }) {
    return repository.get(await guardar(null, body));
  },

  async actualizar({ params, body }) {
    return repository.get(await guardar(params.id, body));
  },

  async eliminar({ params, user }) {
    if (params.id === user.id) throw ApiError.badRequest('No puede eliminar su propio usuario');
    if (!(await repository.remove(params.id))) throw noEncontrado();
    return { eliminado: true };
  },
};
