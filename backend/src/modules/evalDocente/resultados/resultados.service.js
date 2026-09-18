// RF-EVAL-02/03/05 — Resultados del Acuerdo 058
// Lógica de negocio del sub-módulo; el acceso a datos va en ./resultados.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Resultados consolidados del docente autenticado (solo periodos publicados).
  obtenerPropios: pendiente('resultados.obtenerPropios'),
  // Informe consolidado (%IP, %IN, categorización); el docente solo accede al propio.
  obtenerPorDocente: pendiente('resultados.obtenerPorDocente'),
  // Informe final PDF con gráficas históricas por docente.
  informePdf: pendiente('resultados.informePdf'),
};
