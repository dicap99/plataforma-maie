// RF-ADM-01 — Gestión académica: cohortes
// Lógica de negocio del sub-módulo; el acceso a datos va en ./cohortes.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Listado de cohortes con estadísticas (inscritos, matriculados, graduados, egresados).
  listar: pendiente('cohortes.listar'),
  // Detalle de cohortes con estadísticas (inscritos, matriculados, graduados, egresados).
  obtener: pendiente('cohortes.obtener'),
  // Registro de cohortes con estadísticas (inscritos, matriculados, graduados, egresados).
  crear: pendiente('cohortes.crear'),
  // Actualización de cohortes con estadísticas (inscritos, matriculados, graduados, egresados).
  actualizar: pendiente('cohortes.actualizar'),
  // Eliminación de cohortes con estadísticas (inscritos, matriculados, graduados, egresados).
  eliminar: pendiente('cohortes.eliminar'),
};
