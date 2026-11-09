// RNF-SEG-01/02 — Autenticación JWT y credenciales bcrypt
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const repository = require('./auth.repository');

// Hash de relleno para que un correo inexistente tarde lo mismo que una contraseña errada.
const HASH_RELLENO = bcrypt.hashSync('relleno-no-valido', env.bcryptCost);

const aPublico = ({ password_hash: _omit, ...usuario }) => usuario;

const firmarToken = (usuario) =>
  jwt.sign(
    { sub: usuario.id_usuario, rol: usuario.rol, nombre: `${usuario.nombres} ${usuario.apellidos}` },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

// Inicio de sesión: devuelve el JWT y los datos públicos del usuario.
const login = async ({ body }) => {
  const usuario = await repository.findByEmail(body.email);
  const valido = await bcrypt.compare(body.password, usuario?.password_hash ?? HASH_RELLENO);
  if (!usuario || !valido) throw ApiError.unauthorized('Correo o contraseña incorrectos');
  if (!usuario.activo) throw ApiError.forbidden('La cuenta está desactivada');
  return { token: firmarToken(usuario), usuario: aPublico(usuario) };
};

// Perfil de la sesión activa (el token puede seguir vigente para un usuario ya desactivado).
const me = async ({ user }) => {
  const usuario = await repository.findById(user.id);
  if (!usuario || !usuario.activo) throw ApiError.unauthorized('La sesión ya no es válida');
  return aPublico(usuario);
};

// Cambio de la contraseña propia verificando la actual.
const cambiarPassword = async ({ user, body }) => {
  const usuario = await repository.findById(user.id);
  if (!usuario || !(await bcrypt.compare(body.actual, usuario.password_hash))) {
    throw ApiError.badRequest('La contraseña actual no es correcta');
  }
  await repository.updatePassword(user.id, await bcrypt.hash(body.nueva, env.bcryptCost));
  return { mensaje: 'Contraseña actualizada' };
};

module.exports = { login, me, cambiarPassword };
