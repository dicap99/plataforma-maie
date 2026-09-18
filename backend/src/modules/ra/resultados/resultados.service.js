// RF-RA-01 — Resultados de Aprendizaje RA1–RA7
// Lógica de negocio del sub-módulo; el acceso a datos va en ./resultados.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Listado de RA1–RA7 con sus estrategias asociadas.
  listar: pendiente('resultados.listar'),
  // Detalle de un resultado de aprendizaje.
  obtener: pendiente('resultados.obtener'),
};
