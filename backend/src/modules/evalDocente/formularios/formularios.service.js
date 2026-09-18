// RF-EVAL-01 — Formatos digitales del Acuerdo 058
// Lógica de negocio del sub-módulo; el acceso a datos va en ./formularios.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Preguntas del formulario EE, EC o AE; el servicio valida que el tipo corresponda al rol.
  obtener: pendiente('formularios.obtener'),
};
