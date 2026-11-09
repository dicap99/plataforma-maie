// RNF-SEG-01 — Gestión de usuarios y roles (RBAC)
const bcrypt = require('bcryptjs');
const env = require('../../config/env');
const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const { ROLES } = require('../../utils/roles');
const repository = require('./usuarios.repository');

const noEncontrado = () => ApiError.notFound('Usuario no encontrado');

// Docente: deja el usuario vinculado a un perfil (el indicado, el que ya tenía, uno sin cuenta con el
// mismo nombre o uno nuevo) y guarda en él la afiliación (con departamento y universidad) y los campos
// de formación.
const guardarPerfilDocente = async (cliente, idUsuario, body) => {
  // Solo se cambian los datos enviados (undefined = conservar); un texto vacío borra el dato.
  const texto = (v) => (v === undefined ? undefined : v?.trim() || null);
  const campos = body.campos_formacion ? [...new Set(body.campos_formacion.map((c) => c.trim()).filter(Boolean))] : undefined;
  const perfil = {
    afiliacion: body.afiliacion ?? undefined,
    campo_formacion: campos && (campos.join(repository.SEPARADOR_CAMPOS) || null),
    departamento: texto(body.departamento),
    // La universidad solo aplica a los externos: un docente UDENAR no la conserva.
    universidad: body.afiliacion === 'UDENAR' ? null : texto(body.universidad),
  };
  if (body.id_docente) {
    if (!(await repository.vincularDocente(cliente, idUsuario, body.id_docente))) throw ApiError.badRequest('El perfil docente indicado no existe');
    return repository.actualizarPerfil(cliente, body.id_docente, perfil);
  }
  const propio = await repository.perfilDe(cliente, idUsuario);
  if (propio) return repository.actualizarPerfil(cliente, propio.id_docente, perfil);
  const nombre = `${body.nombres.trim()} ${body.apellidos.trim()}`;
  const homonimo = await repository.perfilPorNombre(cliente, nombre);
  if (homonimo && homonimo.id_usuario) throw ApiError.conflict(`Ya existe un perfil docente de «${nombre}» vinculado a otra cuenta`);
  if (homonimo) {
    await repository.vincularDocente(cliente, idUsuario, homonimo.id_docente);
    return repository.actualizarPerfil(cliente, homonimo.id_docente, perfil);
  }
  if (!perfil.afiliacion) throw ApiError.badRequest('Indique si el docente es UDENAR o externo');
  return repository.crearPerfil(cliente, idUsuario, { ...perfil, nombre_completo: nombre });
};

// Crea/actualiza el usuario con lo propio de su rol (perfil docente, o promoción del estudiante) en una
// sola transacción. La beca y los beneficios por semestre no se editan aquí sino en la pestaña
// «Beneficios» (beneficios.service.js), como se acordó en la asesoría del 20-oct-2026.
const guardar = async (id, body) => {
  // Teléfono: sin enviar se conserva (como los datos del perfil docente); vacío lo borra.
  const datos = { ...body, telefono: body.telefono === undefined ? undefined : body.telefono?.trim() || null };
  if (body.password) datos.password_hash = await bcrypt.hash(body.password, env.bcryptCost);
  const esDocente = body.rol === ROLES.DOCENTE;
  const esEstudiante = body.rol === ROLES.ESTUDIANTE;
  if ((body.id_docente || body.afiliacion || body.departamento || body.universidad || body.campos_formacion?.length) && !esDocente) {
    throw ApiError.badRequest('El perfil docente (afiliación, departamento, universidad y campos de formación) es solo para el rol docente');
  }
  if (body.id_cohorte && !esEstudiante) throw ApiError.badRequest('La promoción es solo para el rol estudiante');
  if (body.id_cohorte && !(await repository.existeCohorte(body.id_cohorte))) throw ApiError.badRequest('La promoción indicada no existe');

  return db.withTransaction(async (cliente) => {
    let idUsuario = id;
    if (id) {
      const { rowCount } = await repository.update(cliente, id, datos);
      if (!rowCount) throw noEncontrado();
    } else {
      idUsuario = (await repository.create(cliente, datos)).rows[0].id_usuario;
    }
    if (esDocente) {
      await guardarPerfilDocente(cliente, idUsuario, body);
    } else if (body.id_docente !== undefined || id) {
      await repository.vincularDocente(cliente, idUsuario, null);
    }
    if (esEstudiante && body.id_cohorte) {
      await repository.asignarPromocion(cliente, idUsuario, body.id_cohorte);
    } else if (esEstudiante && body.id_cohorte === null) await repository.quitarPromocion(cliente, idUsuario);
    else if (!esEstudiante && id) await repository.quitarPromocion(cliente, idUsuario);
    return idUsuario;
  });
};

module.exports = {
  listar: ({ query }) => repository.list({ rol: query.rol ?? null }),

  camposFormacion: () => repository.camposFormacion(),

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
