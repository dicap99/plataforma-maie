// RF-EVAL-04/05 — Periodos de evaluación docente
// Lógica de negocio del sub-módulo; el acceso a datos va en ./periodos.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Periodo de evaluación abierto actualmente.
  obtenerActivo: pendiente('periodos.obtenerActivo'),
  // Listado de periodos de evaluación.
  listar: pendiente('periodos.listar'),
  // Apertura de un periodo de evaluación.
  crear: pendiente('periodos.crear'),
  // Actualización de fechas del periodo.
  actualizar: pendiente('periodos.actualizar'),
  // Cierra el periodo, calcula resultados y los publica a los docentes.
  publicar: pendiente('periodos.publicar'),
  // Métricas de programa IDST-D, IDSC-Prom e IDSC-Prog.
  indicadores: pendiente('periodos.indicadores'),
};
