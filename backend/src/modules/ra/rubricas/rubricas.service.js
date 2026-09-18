// RF-RA-01 — Rúbricas (Alto, Medio, Básico, Insuficiente)
// Lógica de negocio del sub-módulo; el acceso a datos va en ./rubricas.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Matriz de rúbricas de los 7 RA (filtro opcional ?ra=).
  listar: pendiente('rubricas.listar'),
  // Registro de un criterio de rúbrica.
  crear: pendiente('rubricas.crear'),
  // Actualización de un criterio de rúbrica.
  actualizar: pendiente('rubricas.actualizar'),
  // Eliminación de un criterio de rúbrica.
  eliminar: pendiente('rubricas.eliminar'),
};
