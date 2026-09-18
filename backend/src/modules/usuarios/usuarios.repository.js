// Acceso a datos (PostgreSQL) — RNF-SEG-01 — Gestión de usuarios y roles (RBAC)
// Tablas: usuarios, docentes_perfil (vínculo opcional del usuario docente con su perfil)
const db = require('../../config/db');

const SELECT = `
  SELECT u.id_usuario, u.identificacion, u.nombres, u.apellidos, u.email, u.rol, u.activo, u.creado_en,
         d.id_docente, d.nombre_completo AS docente_vinculado
  FROM usuarios u
  LEFT JOIN docentes_perfil d ON d.id_usuario = u.id_usuario`;

const list = async () => (await db.query(`${SELECT} ORDER BY u.rol, u.apellidos, u.nombres`)).rows;

const get = async (id) => (await db.query(`${SELECT} WHERE u.id_usuario = $1`, [id])).rows[0] ?? null;

const create = (cliente, u) =>
  cliente.query(
    `INSERT INTO usuarios (identificacion, nombres, apellidos, email, password_hash, rol, activo)
     VALUES ($1, $2, $3, LOWER($4), $5, $6, $7) RETURNING id_usuario`,
    [u.identificacion, u.nombres, u.apellidos, u.email, u.password_hash, u.rol, u.activo ?? true],
  );

const update = (cliente, id, u) =>
  cliente.query(
    `UPDATE usuarios SET identificacion = $2, nombres = $3, apellidos = $4, email = LOWER($5), rol = $6, activo = $7,
            password_hash = COALESCE($8, password_hash)
     WHERE id_usuario = $1`,
    [id, u.identificacion, u.nombres, u.apellidos, u.email, u.rol, u.activo ?? true, u.password_hash ?? null],
  );

// Deja el usuario vinculado a lo sumo a un perfil docente (o a ninguno si idDocente es null).
const vincularDocente = async (cliente, idUsuario, idDocente) => {
  await cliente.query('UPDATE docentes_perfil SET id_usuario = NULL WHERE id_usuario = $1', [idUsuario]);
  if (!idDocente) return 0;
  const { rowCount } = await cliente.query(
    'UPDATE docentes_perfil SET id_usuario = $2 WHERE id_docente = $1',
    [idDocente, idUsuario],
  );
  return rowCount;
};

const remove = async (id) => (await db.query('DELETE FROM usuarios WHERE id_usuario = $1', [id])).rowCount > 0;

module.exports = { list, get, create, update, vincularDocente, remove };
