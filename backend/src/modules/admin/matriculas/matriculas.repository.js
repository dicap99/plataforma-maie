// Acceso a datos (PostgreSQL) — RF-ADM-01 / RF-RA-02 — Estudiantes de cada promoción
// Tablas: cohorte_estudiantes, usuarios
const db = require('../../../config/db');

const list = async (idCohorte) =>
  (await db.query(
    `SELECT u.id_usuario AS id_estudiante, u.identificacion, u.nombres, u.apellidos, u.email, he.estado, he.fecha_grado
     FROM cohorte_estudiantes he
     JOIN usuarios u ON u.id_usuario = he.id_estudiante
     WHERE he.id_cohorte = $1
     ORDER BY u.apellidos, u.nombres`,
    [idCohorte],
  )).rows;

const existeCohorte = async (id) => (await db.query('SELECT 1 FROM cohortes WHERE id_cohorte = $1', [id])).rowCount > 0;

// Deja en la promoción exactamente a `filas` [{ id_estudiante, estado }], actualizando el estado.
const reemplazar = async (cliente, idCohorte, filas) => {
  const ids = filas.map((f) => f.id_estudiante);
  await cliente.query(
    'DELETE FROM cohorte_estudiantes WHERE id_cohorte = $1 AND NOT (id_estudiante = ANY($2::uuid[]))',
    [idCohorte, ids],
  );
  if (filas.length) {
    await cliente.query(
      `INSERT INTO cohorte_estudiantes (id_cohorte, id_estudiante, estado)
       SELECT $1, x.id, x.estado FROM unnest($2::uuid[], $3::varchar[]) AS x(id, estado)
       ON CONFLICT (id_cohorte, id_estudiante) DO UPDATE SET estado = EXCLUDED.estado`,
      [idCohorte, ids, filas.map((f) => f.estado ?? 'matriculado')],
    );
  }
};

module.exports = { list, existeCohorte, reemplazar };
