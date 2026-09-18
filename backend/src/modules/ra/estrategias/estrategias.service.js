// RF-RA-01 — Estrategias de evaluación E1–E6
// Lógica de negocio del sub-módulo; el acceso a datos va en ./estrategias.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Listado de estrategias de evaluación E1–E6.
  listar: pendiente('estrategias.listar'),
};
