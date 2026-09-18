// RF-ADM-03 — Gestión financiera: transferencias y contratos OPS
// Lógica de negocio del sub-módulo; el acceso a datos va en ./finanzas.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Listado de transferencias.
  listarTransferencias: pendiente('finanzas.listarTransferencias'),
  // Registro de transferencias.
  crearTransferencias: pendiente('finanzas.crearTransferencias'),
  // Actualización de transferencias.
  actualizarTransferencias: pendiente('finanzas.actualizarTransferencias'),
  // Eliminación de transferencias.
  eliminarTransferencias: pendiente('finanzas.eliminarTransferencias'),
  // Listado de contratos por OPS.
  listarContratosOps: pendiente('finanzas.listarContratosOps'),
  // Registro de contratos por OPS.
  crearContratosOps: pendiente('finanzas.crearContratosOps'),
  // Actualización de contratos por OPS.
  actualizarContratosOps: pendiente('finanzas.actualizarContratosOps'),
  // Eliminación de contratos por OPS.
  eliminarContratosOps: pendiente('finanzas.eliminarContratosOps'),
};
