// RF-ADM-06 — Perfil del docente y cursos en los que participa.
// El docente mantiene su perfil y sus cursos; Coordinación puede hacerlo por cualquier docente.
// Los cursos alimentan «Cursos y docentes por semestre» y los componentes que apoya.
const ApiError = require('../../../utils/ApiError');
const repository = require('./docentes.repository');

const sinPerfil = () =>
  ApiError.notFound('Su usuario no está vinculado a un perfil docente; solicítelo a Coordinación');

// Semestre de la promoción en que cae el periodo (1 = periodo de inicio).
const semestreDe = (periodo, inicio) => {
  const valor = (p) => Number(p.slice(0, 4)) * 2 + (p.endsWith('B') ? 1 : 0);
  return valor(periodo) - valor(inicio) + 1;
};

const conCursos = async (perfil) => {
  const cursos = await repository.cursosDe(perfil.id_docente);
  const componentes = [...new Map(cursos.map((c) => [c.id_modulo, c.componente])).values()];
  return { ...perfil, cursos, componentes };
};

const perfilPropio = async (user) => {
  const perfil = await repository.findByUsuario(user.id);
  if (!perfil) throw sinPerfil();
  return perfil;
};

const perfilPorId = async (id) => {
  const perfil = await repository.findById(id);
  if (!perfil) throw ApiError.notFound('Docente no encontrado');
  return perfil;
};

const agregar = async (perfil, body) => {
  const cohorte = await repository.cohorte(body.id_cohorte);
  if (!cohorte) throw ApiError.badRequest('La promoción no existe');
  const semestre = semestreDe(body.periodo, cohorte.periodo_inicio);
  if (semestre < 1 || semestre > 4) {
    throw ApiError.badRequest(`El periodo ${body.periodo} no es uno de los cuatro semestres de la promoción ${cohorte.nombre} (inicia en ${cohorte.periodo_inicio})`);
  }
  if (!(await repository.clase(body.id_clase))) throw ApiError.badRequest('El curso no existe');
  await repository.agregarCurso(perfil.id_docente, body);
  return conCursos(perfil);
};

const quitar = async (perfil, idCurso) => {
  if (!(await repository.quitarCurso(perfil.id_docente, idCurso))) {
    throw ApiError.notFound('El docente no participa en ese curso');
  }
  return conCursos(perfil);
};

module.exports = {
  semestreDe,

  obtenerPerfilPropio: async ({ user }) => conCursos(await perfilPropio(user)),

  async actualizarPerfilPropio({ user, body }) {
    const perfil = await repository.updateByUsuario(user.id, body);
    if (!perfil) throw sinPerfil();
    return conCursos(perfil);
  },

  agregarCursoPropio: async ({ user, body }) => agregar(await perfilPropio(user), body),
  quitarCursoPropio: async ({ user, params }) => quitar(await perfilPropio(user), params.idCurso),

  obtenerPerfil: async ({ params }) => conCursos(await perfilPorId(params.id)),
  agregarCurso: async ({ params, body }) => agregar(await perfilPorId(params.id), body),
  quitarCurso: async ({ params }) => quitar(await perfilPorId(params.id), params.idCurso),
};
