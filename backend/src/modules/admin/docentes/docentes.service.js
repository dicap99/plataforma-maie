// RF-ADM-06 — Perfil histórico del docente (vista del propio docente)
const ApiError = require('../../../utils/ApiError');
const repository = require('./docentes.repository');

const sinPerfil = () =>
  ApiError.notFound('Su usuario no está vinculado a un perfil docente; solicítelo a Coordinación');

module.exports = {
  async obtenerPerfilPropio({ user }) {
    const perfil = await repository.findByUsuario(user.id);
    if (!perfil) throw sinPerfil();
    return perfil;
  },

  async actualizarPerfilPropio({ user, body }) {
    const perfil = await repository.updateByUsuario(user.id, body);
    if (!perfil) throw sinPerfil();
    return perfil;
  },
};
