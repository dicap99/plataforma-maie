// Acceso a datos (PostgreSQL) — RF-ADM-06 — Perfil del docente autenticado
// Tablas: docentes_perfil (el CRUD de Coordinación usa el recurso genérico "docentes")
const db = require('../../../config/db');

// Campos que el propio docente puede mantener; nombre y afiliación los administra Coordinación.
const CAMPOS_EDITABLES = [
  'formacion_profesional',
  'campo_formacion',
  'componentes',
  'cursos_participa',
  'enlace_perfil',
  'titulacion_maxima',
  'linea_investigacion',
];

const findByUsuario = async (idUsuario) => {
  const { rows } = await db.query('SELECT * FROM docentes_perfil WHERE id_usuario = $1', [idUsuario]);
  return rows[0] ?? null;
};

const updateByUsuario = async (idUsuario, datos) => {
  const sets = CAMPOS_EDITABLES.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const { rows } = await db.query(
    `UPDATE docentes_perfil SET ${sets} WHERE id_usuario = $1 RETURNING *`,
    [idUsuario, ...CAMPOS_EDITABLES.map((c) => datos[c] ?? null)],
  );
  return rows[0] ?? null;
};

module.exports = { CAMPOS_EDITABLES, findByUsuario, updateByUsuario };
