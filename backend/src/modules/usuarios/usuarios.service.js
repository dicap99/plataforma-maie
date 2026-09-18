// RNF-SEG-01 — Gestión de usuarios y roles (RBAC)
// Lógica de negocio del sub-módulo; el acceso a datos va en ./usuarios.repository.js
const pendiente = require('../../utils/pendiente');

module.exports = {
  // Listado de usuarios.
  listar: pendiente('usuarios.listar'),
  // Detalle de usuarios.
  obtener: pendiente('usuarios.obtener'),
  // Registro de usuarios.
  crear: pendiente('usuarios.crear'),
  // Actualización de usuarios.
  actualizar: pendiente('usuarios.actualizar'),
  // Eliminación de usuarios.
  eliminar: pendiente('usuarios.eliminar'),
};
