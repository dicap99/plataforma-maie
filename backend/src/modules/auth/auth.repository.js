// Acceso a datos (PostgreSQL) — RNF-SEG-01/02 — Autenticación
// Tablas: usuarios
const db = require('../../config/db');

const CAMPOS_PUBLICOS = 'id_usuario, identificacion, nombres, apellidos, email, rol, activo';

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

const updatePassword = async (id, passwordHash) => {
  await db.query('UPDATE usuarios SET password_hash = $2 WHERE id_usuario = $1', [id, passwordHash]);
};

module.exports = { findByEmail, findById, updatePassword };
