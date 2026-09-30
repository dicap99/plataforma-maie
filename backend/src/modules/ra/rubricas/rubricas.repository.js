// Acceso a datos (PostgreSQL) — RF-RA-01 — Rúbricas institucionales por RA
// Tablas: rubricas_criterios, resultados_aprendizaje, evaluaciones_ra_estudiante
const db = require('../../../config/db');

const CAMPOS = `rc.id_criterio, rc.id_ra, rc.orden, rc.nombre_criterio, rc.peso_porcentaje,
  rc.desc_nivel_alto, rc.desc_nivel_medio, rc.desc_nivel_basico, rc.desc_nivel_insuficiente`;

const listRA = async (idRa = null) =>
  (await db.query(
    'SELECT id_ra, codigo, descripcion FROM resultados_aprendizaje WHERE ($1::int IS NULL OR id_ra = $1) ORDER BY id_ra',
    [idRa],
  )).rows;

const listCriterios = async (idsRa) =>
  (await db.query(
    `SELECT ${CAMPOS} FROM rubricas_criterios rc WHERE rc.id_ra = ANY($1::int[]) ORDER BY rc.id_ra, rc.orden`,
    [idsRa],
  )).rows;

// Criterios del RA que tienen calificaciones y no están entre los que se conservan.
const calificadosFuera = async (idRa, conservar) =>
  (await db.query(
    `SELECT DISTINCT rc.id_criterio, rc.nombre_criterio
     FROM rubricas_criterios rc JOIN evaluaciones_ra_estudiante e USING (id_criterio)
     WHERE rc.id_ra = $1 AND NOT (rc.id_criterio = ANY($2::int[]))`,
    [idRa, conservar],
  )).rows;

// Reemplaza la rúbrica completa del RA: actualiza los criterios con id, inserta los nuevos y
// borra los que no vienen. El orden se desplaza primero para no chocar con UNIQUE (id_ra, orden).
const reemplazar = async (cliente, idRa, criterios) => {
  const conservar = criterios.filter((c) => c.id_criterio).map((c) => c.id_criterio);
  await cliente.query(
    'DELETE FROM rubricas_criterios WHERE id_ra = $1 AND NOT (id_criterio = ANY($2::int[]))',
    [idRa, conservar],
  );
  await cliente.query('UPDATE rubricas_criterios SET orden = orden + 1000 WHERE id_ra = $1', [idRa]);
  for (const c of criterios) {
    const valores = [c.orden, c.nombre_criterio, c.peso_porcentaje, c.desc_nivel_alto, c.desc_nivel_medio,
      c.desc_nivel_basico, c.desc_nivel_insuficiente];
    if (c.id_criterio) {
      await cliente.query(
        `UPDATE rubricas_criterios SET orden = $3, nombre_criterio = $4, peso_porcentaje = $5, desc_nivel_alto = $6,
                desc_nivel_medio = $7, desc_nivel_basico = $8, desc_nivel_insuficiente = $9
         WHERE id_criterio = $1 AND id_ra = $2`,
        [c.id_criterio, idRa, ...valores],
      );
    } else {
      await cliente.query(
        `INSERT INTO rubricas_criterios (id_ra, orden, nombre_criterio, peso_porcentaje, desc_nivel_alto,
                desc_nivel_medio, desc_nivel_basico, desc_nivel_insuficiente)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [idRa, ...valores],
      );
    }
  }
};

module.exports = { listRA, listCriterios, calificadosFuera, reemplazar };
