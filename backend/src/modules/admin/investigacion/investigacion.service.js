// RF-ADM-04 — Investigación: productos y pasantías
// Lógica de negocio del sub-módulo; el acceso a datos va en ./investigacion.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Listado de productos científicos (artículos, tesis, software).
  listarProductos: pendiente('investigacion.listarProductos'),
  // Registro de productos científicos (artículos, tesis, software).
  crearProductos: pendiente('investigacion.crearProductos'),
  // Actualización de productos científicos (artículos, tesis, software).
  actualizarProductos: pendiente('investigacion.actualizarProductos'),
  // Eliminación de productos científicos (artículos, tesis, software).
  eliminarProductos: pendiente('investigacion.eliminarProductos'),
  // Listado de estancias y pasantías académicas.
  listarPasantias: pendiente('investigacion.listarPasantias'),
  // Registro de estancias y pasantías académicas.
  crearPasantias: pendiente('investigacion.crearPasantias'),
  // Actualización de estancias y pasantías académicas.
  actualizarPasantias: pendiente('investigacion.actualizarPasantias'),
  // Eliminación de estancias y pasantías académicas.
  eliminarPasantias: pendiente('investigacion.eliminarPasantias'),
};
