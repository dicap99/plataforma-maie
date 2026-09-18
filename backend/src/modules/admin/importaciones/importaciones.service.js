// RF-ADM-01 — Importación masiva CSV/Excel
// Lógica de negocio del sub-módulo; el acceso a datos va en ./importaciones.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Carga masiva de un archivo .csv/.xlsx (campo "archivo"); el tipo de datos se indica con ?tipo=.
  importar: pendiente('importaciones.importar'),
};
