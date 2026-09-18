// RF-ADM-03 — Gestión financiera: presupuesto por cohorte
// Lógica de negocio del sub-módulo; el acceso a datos va en ./presupuesto.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Consolidado de rubros asignados, comprometidos y ejecutados.
  resumen: pendiente('presupuesto.resumen'),
  // Listado de rubros de presupuesto.
  listar: pendiente('presupuesto.listar'),
  // Detalle de rubros de presupuesto.
  obtener: pendiente('presupuesto.obtener'),
  // Registro de rubros de presupuesto.
  crear: pendiente('presupuesto.crear'),
  // Actualización de rubros de presupuesto.
  actualizar: pendiente('presupuesto.actualizar'),
  // Eliminación de rubros de presupuesto.
  eliminar: pendiente('presupuesto.eliminar'),
};
