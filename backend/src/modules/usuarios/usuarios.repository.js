// Acceso a datos (PostgreSQL) — RNF-SEG-01 — Gestión de usuarios y roles (RBAC)
// Tablas: usuarios, docentes_perfil (perfil del docente: afiliación y campos de formación),
// cohorte_estudiantes (promoción y beca del estudiante)
const db = require('../../config/db');

// Separador con el que se guardan varios campos de formación en docentes_perfil.campo_formacion.
const SEPARADOR_CAMPOS = ', ';

const SELECT = `
  SELECT u.id_usuario, u.identificacion, u.nombres, u.apellidos, u.email, u.rol, u.activo, u.debe_cambiar_password, u.creado_en,
         d.id_docente, d.nombre_completo AS docente_vinculado, d.afiliacion, d.campo_formacion,
         he.id_cohorte, h.nombre AS cohorte, he.beca, he.estado AS estado_promocion
  FROM usuarios u
  LEFT JOIN docentes_perfil d ON d.id_usuario = u.id_usuario
  LEFT JOIN LATERAL (SELECT x.* FROM cohorte_estudiantes x JOIN cohortes c USING (id_cohorte)
                     WHERE x.id_estudiante = u.id_usuario ORDER BY c.periodo_inicio DESC LIMIT 1) he ON TRUE
  LEFT JOIN cohortes h ON h.id_cohorte = he.id_cohorte`;

const list = async ({ rol = null } = {}) =>
  (await db.query(`${SELECT} WHERE ($1::tipo_rol IS NULL OR u.rol = $1) ORDER BY u.rol, u.apellidos, u.nombres`, [rol])).rows;

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

// Promoción y beca del estudiante: queda en una sola promoción (conserva su estado si ya estaba).
const asignarPromocion = async (cliente, idUsuario, idCohorte, beca) => {
  await cliente.query('DELETE FROM cohorte_estudiantes WHERE id_estudiante = $1 AND id_cohorte <> $2', [idUsuario, idCohorte]);
  await cliente.query(
    `INSERT INTO cohorte_estudiantes (id_cohorte, id_estudiante, beca) VALUES ($1, $2, $3)
     ON CONFLICT (id_cohorte, id_estudiante) DO UPDATE SET beca = EXCLUDED.beca`,
    [idCohorte, idUsuario, beca ?? null],
  );
};

const quitarPromocion = (cliente, idUsuario) =>
  cliente.query('DELETE FROM cohorte_estudiantes WHERE id_estudiante = $1', [idUsuario]);

const existeCohorte = async (id) => (await db.query('SELECT 1 FROM cohortes WHERE id_cohorte = $1', [id])).rowCount > 0;

const perfilDe = async (cliente, idUsuario) =>
  (await cliente.query('SELECT id_docente FROM docentes_perfil WHERE id_usuario = $1', [idUsuario])).rows[0] ?? null;

const perfilPorNombre = async (cliente, nombre) =>
  (await cliente.query('SELECT id_docente, id_usuario FROM docentes_perfil WHERE LOWER(nombre_completo) = LOWER($1)', [nombre])).rows[0] ?? null;

const crearPerfil = async (cliente, idUsuario, p) =>
  (await cliente.query(
    `INSERT INTO docentes_perfil (id_usuario, nombre_completo, afiliacion, campo_formacion)
     VALUES ($1, $2, $3, $4) RETURNING id_docente`,
    [idUsuario, p.nombre_completo, p.afiliacion, p.campo_formacion],
  )).rows[0].id_docente;

// Actualiza afiliación y campos del perfil; los valores no enviados se conservan.
const actualizarPerfil = (cliente, idDocente, p) =>
  cliente.query(
    `UPDATE docentes_perfil SET afiliacion = COALESCE($2::tipo_afiliacion, afiliacion),
            campo_formacion = COALESCE($3, campo_formacion)
     WHERE id_docente = $1`,
    [idDocente, p.afiliacion ?? null, p.campo_formacion ?? null],
  );

// Campos de formación registrados (para el selector con buscador del formulario).
const camposFormacion = async () =>
  (await db.query(
    `SELECT DISTINCT TRIM(c) AS campo
     FROM docentes_perfil, regexp_split_to_table(COALESCE(campo_formacion, ''), '\\s*(,|\\n|\\s-\\s|\\+)\\s*') AS c
     WHERE TRIM(BOTH ' -•' FROM c) <> ''
     ORDER BY 1`,
  )).rows
    .map((r) => r.campo.replace(/^[-•\s]+/, '').trim())
    .filter((c, i, todos) => c && todos.indexOf(c) === i)
    .sort((a, b) => a.localeCompare(b, 'es'));

const remove = async (id) => (await db.query('DELETE FROM usuarios WHERE id_usuario = $1', [id])).rowCount > 0;

module.exports = {
  SEPARADOR_CAMPOS,
  list,
  get,
  create,
  update,
  vincularDocente,
  asignarPromocion,
  quitarPromocion,
  existeCohorte,
  perfilDe,
  perfilPorNombre,
  crearPerfil,
  actualizarPerfil,
  camposFormacion,
  remove,
};
