// RF-RA-03/04 — Clasificación e indicadores de RA
// Lógica de negocio del sub-módulo; el acceso a datos va en ./reportes.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Distribución de niveles con ?nivel=estudiante|curso|modulo|cohorte|programa (combinables).
  consolidado: pendiente('reportes.consolidado'),
};
