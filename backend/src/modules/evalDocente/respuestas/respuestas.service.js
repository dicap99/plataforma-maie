// RF-EVAL-01 — Diligenciamiento de encuestas
// Lógica de negocio del sub-módulo; el acceso a datos va en ./respuestas.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Envío de formulario: EE→estudiante, AE→docente (propia), EC→coordinador.
  registrar: pendiente('respuestas.registrar'),
};
