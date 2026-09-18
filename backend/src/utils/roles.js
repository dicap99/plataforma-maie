// Valores del ENUM tipo_rol (database/init.sql).
const ROLES = Object.freeze({
  COORDINADOR: 'coordinador',
  DOCENTE: 'docente',
  ESTUDIANTE: 'estudiante',
});

const TODOS = Object.values(ROLES);

module.exports = { ROLES, TODOS };
