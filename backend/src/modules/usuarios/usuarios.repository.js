// Acceso a datos (PostgreSQL) — RNF-SEG-01 — Gestión de usuarios y roles (RBAC)
// Tablas: usuarios, docentes_perfil (perfil del docente: afiliación y campos de formación),
// cohorte_estudiantes (promoción y beca del estudiante), estudiante_beneficios (beneficios por semestre)
const db = require('../../config/db');

// Separador con el que se guardan varios campos de formación en docentes_perfil.campo_formacion.
const SEPARADOR_CAMPOS = ', ';

const SELECT = `
  SELECT u.id_usuario, u.identificacion, u.nombres, u.apellidos, u.email, u.telefono, u.rol, u.activo, u.debe_cambiar_password, u.creado_en,
         d.id_docente, d.nombre_completo AS docente_vinculado, d.afiliacion, d.departamento, d.universidad, d.campo_formacion,
         he.id_cohorte, h.nombre AS cohorte, he.beca, he.estado AS estado_promocion,
         COALESCE((SELECT json_agg(json_build_object('semestre', b.semestre, 'tipo', b.tipo) ORDER BY b.semestre, b.tipo)
                   FROM estudiante_beneficios b
                   WHERE b.id_cohorte = he.id_cohorte AND b.id_estudiante = u.id_usuario), '[]') AS beneficios
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
    `INSERT INTO usuarios (identificacion, nombres, apellidos, email, telefono, password_hash, rol, activo)
     VALUES ($1, $2, $3, LOWER($4), $5, $6, $7, $8) RETURNING id_usuario`,
    [u.identificacion, u.nombres, u.apellidos, u.email, u.telefono ?? null, u.password_hash, u.rol, u.activo ?? true],
  );

const update = (cliente, id, u) =>
  cliente.query(
    `UPDATE usuarios SET identificacion = $2, nombres = $3, apellidos = $4, email = LOWER($5),
            telefono = CASE WHEN $10 THEN $6 ELSE telefono END, rol = $7,
            activo = $8, password_hash = COALESCE($9, password_hash)
     WHERE id_usuario = $1`,
    [id, u.identificacion, u.nombres, u.apellidos, u.email, u.telefono ?? null, u.rol, u.activo ?? true, u.password_hash ?? null,
      u.telefono !== undefined],
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

// Promoción del estudiante: queda en una sola promoción. Si ya estaba en ella conserva su estado, beca
// y beneficios; al cambiar de promoción los de la anterior se borran (ON DELETE CASCADE).
const asignarPromocion = async (cliente, idUsuario, idCohorte) => {
  await cliente.query('DELETE FROM cohorte_estudiantes WHERE id_estudiante = $1 AND id_cohorte <> $2', [idUsuario, idCohorte]);
  await cliente.query(
    `INSERT INTO cohorte_estudiantes (id_cohorte, id_estudiante) VALUES ($1, $2)
     ON CONFLICT (id_cohorte, id_estudiante) DO NOTHING`,
    [idCohorte, idUsuario],
  );
};

// Estudiantes de una promoción con su beca y sus beneficios por semestre (pestaña «Beneficios»).
// Con `idUsuario`, solo ese estudiante (vacío si no está en la promoción).
const estudiantesConBeneficios = async (idCohorte, idUsuario = null, cliente = db) =>
  (await cliente.query(
    `SELECT u.id_usuario, u.identificacion, u.nombres, u.apellidos, u.activo, ce.beca, ce.estado AS estado_promocion,
            COALESCE((SELECT json_agg(json_build_object('semestre', b.semestre, 'tipo', b.tipo) ORDER BY b.semestre, b.tipo)
                      FROM estudiante_beneficios b
                      WHERE b.id_cohorte = ce.id_cohorte AND b.id_estudiante = u.id_usuario), '[]') AS beneficios
     FROM cohorte_estudiantes ce
     JOIN usuarios u ON u.id_usuario = ce.id_estudiante
     WHERE ce.id_cohorte = $1 AND ($2::uuid IS NULL OR u.id_usuario = $2) AND u.rol = 'estudiante'
     ORDER BY u.apellidos, u.nombres`,
    [idCohorte, idUsuario],
  )).rows;

// Beneficios del estudiante en cada semestre de UNA promoción: quedan exactamente los indicados y la
// beca que los resume (cohorte_estudiantes.beca) se actualiza con ellos; las demás promociones no se tocan.
const reemplazarBeneficios = async (cliente, idUsuario, idCohorte, beneficios, beca) => {
  await cliente.query('UPDATE cohorte_estudiantes SET beca = $3 WHERE id_cohorte = $1 AND id_estudiante = $2', [idCohorte, idUsuario, beca]);
  await cliente.query('DELETE FROM estudiante_beneficios WHERE id_estudiante = $1 AND id_cohorte = $2', [idUsuario, idCohorte]);
  if (!beneficios.length) return;
  await cliente.query(
    `INSERT INTO estudiante_beneficios (id_cohorte, id_estudiante, semestre, tipo)
     SELECT $1, $2, x.semestre, x.tipo FROM unnest($3::smallint[], $4::varchar[]) AS x(semestre, tipo)
     ON CONFLICT DO NOTHING`,
    [idCohorte, idUsuario, beneficios.map((b) => b.semestre), beneficios.map((b) => b.tipo)],
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
    `INSERT INTO docentes_perfil (id_usuario, nombre_completo, afiliacion, campo_formacion, departamento, universidad)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_docente`,
    [idUsuario, p.nombre_completo, p.afiliacion, p.campo_formacion ?? null, p.departamento ?? null, p.universidad ?? null],
  )).rows[0].id_docente;

// Datos del perfil docente que Coordinación registra desde el formulario de Usuarios (el resto del perfil
// se edita en la hoja «Docentes» de Información académica).
const CAMPOS_PERFIL_DESDE_USUARIO = ['afiliacion', 'campo_formacion', 'departamento', 'universidad'];

// Actualiza los datos enviados del perfil; los que llegan como undefined se conservan.
const actualizarPerfil = async (cliente, idDocente, p) => {
  const enviados = CAMPOS_PERFIL_DESDE_USUARIO.filter((c) => p[c] !== undefined);
  if (!enviados.length) return;
  await cliente.query(
    `UPDATE docentes_perfil SET ${enviados.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id_docente = $1`,
    [idDocente, ...enviados.map((c) => p[c])],
  );
};

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
  estudiantesConBeneficios,
  reemplazarBeneficios,
  quitarPromocion,
  existeCohorte,
  perfilDe,
  perfilPorNombre,
  crearPerfil,
  actualizarPerfil,
  camposFormacion,
  remove,
};
