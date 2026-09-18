// RF-ADM-01 — Gestión académica: cursos dictados
// Lógica de negocio del sub-módulo; el acceso a datos va en ./cursos.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Listado de cursos.
  listar: pendiente('cursos.listar'),
  // Detalle de cursos.
  obtener: pendiente('cursos.obtener'),
  // Registro de cursos.
  crear: pendiente('cursos.crear'),
  // Actualización de cursos.
  actualizar: pendiente('cursos.actualizar'),
  // Eliminación de cursos.
  eliminar: pendiente('cursos.eliminar'),
};
