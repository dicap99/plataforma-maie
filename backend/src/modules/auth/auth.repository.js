// Acceso a datos (PostgreSQL) — RNF-SEG-01/02 — Autenticación
// Tablas: usuarios
const db = require('../../config/db');

const CAMPOS_PUBLICOS = 'id_usuario, identificacion, nombres, apellidos, email, rol, activo, debe_cambiar_password';

const findByEmail = async (email) => {
  const { rows } = await db.query(
    `SELECT ${CAMPOS_PUBLICOS}, password_hash FROM usuarios WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  return rows[0] ?? null;
};

const findById = async (id) => {
  const { rows } = await db.query(
    `SELECT ${CAMPOS_PUBLICOS}, password_hash FROM usuarios WHERE id_usuario = $1`,
    [id],
  );
  return rows[0] ?? null;
};

// Al cambiar la contraseña deja de ser temporal.
const updatePassword = async (id, passwordHash) => {
  await db.query('UPDATE usuarios SET password_hash = $2, debe_cambiar_password = FALSE WHERE id_usuario = $1', [id, passwordHash]);
};

// Identificación y correo de la propia cuenta (las cuentas temporales los traen provisionales).
const updateCuenta = async (id, { identificacion, email }) => {
  const { rows } = await db.query(
    `UPDATE usuarios SET identificacion = COALESCE($2, identificacion), email = COALESCE($3, email)
     WHERE id_usuario = $1 RETURNING ${CAMPOS_PUBLICOS}`,
    [id, identificacion ?? null, email ?? null],
  );
  return rows[0] ?? null;
};

module.exports = { findByEmail, findById, updatePassword, updateCuenta };
