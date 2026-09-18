// RNF-SEG-01/02 — Autenticación JWT y credenciales bcrypt
// Lógica de negocio del sub-módulo; el acceso a datos va en ./auth.repository.js
const pendiente = require('../../utils/pendiente');

module.exports = {
  // Autenticación de usuarios y emisión de JWT (8 h).
  login: pendiente('auth.login'),
  // Verificación de perfil activo y permisos de sesión.
  me: pendiente('auth.me'),
};
