// RF-ADM-05 — Reportes estadísticos administrativos
// Lógica de negocio del sub-módulo; el acceso a datos va en ./reportes.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Series para gráficas (barras, pastel, dispersión) de autoevaluación.
  estadisticas: pendiente('reportes.estadisticas'),
};
