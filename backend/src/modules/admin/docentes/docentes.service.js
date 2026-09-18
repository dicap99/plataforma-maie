// RF-ADM-06 — Perfil histórico del docente
// Lógica de negocio del sub-módulo; el acceso a datos va en ./docentes.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Listado de docentes vinculados al programa.
  listar: pendiente('docentes.listar'),
  // Perfil del docente autenticado.
  obtenerPerfilPropio: pendiente('docentes.obtenerPerfilPropio'),
  // El docente actualiza su información básica y formación académica.
  actualizarPerfilPropio: pendiente('docentes.actualizarPerfilPropio'),
  // Perfil e historial de vinculación de un docente.
  obtenerPerfil: pendiente('docentes.obtenerPerfil'),
  // Actualización del perfil de un docente por Coordinación.
  actualizarPerfil: pendiente('docentes.actualizarPerfil'),
};
