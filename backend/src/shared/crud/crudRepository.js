// Repositorio genérico para tablas de un recurso declarativo.
// Los nombres de tabla/columna provienen de la definición del recurso (constantes del código),
// nunca de la petición; los valores siempre van parametrizados.
const db = require('../../config/db');

const id = (nombre) => `"${nombre.replace(/"/g, '""')}"`;

const crudRepository = (recurso) => {
  const { tabla, llave, campos, conflicto = llave, ordenarPor, unirCohorte } = recurso;
  const columnas = campos.map((c) => c.name);
  const noLlave = columnas.filter((c) => !llave.includes(c));
  const whereLlave = llave.map((k, i) => `t.${id(k)} = $${i + 1}`).join(' AND ');

  const select = unirCohorte
    ? `SELECT t.*, c.nombre AS cohorte FROM ${id(tabla)} t JOIN cohortes c ON c.id_cohorte = t.id_cohorte`
    : `SELECT t.* FROM ${id(tabla)} t`;

  // Recarga el registro con el mismo formato que list() (p. ej. con el nombre de la promoción).
  const recargar = async (fila, cliente) => {
    const { rows } = await (cliente ?? db).query(`${select} WHERE ${whereLlave}`, llave.map((k) => fila[k]));
    return rows[0] ?? null;
  };

  const valores = (datos, cols) => cols.map((c) => (datos[c] === undefined ? null : datos[c]));

  return {
    async list() {
      const { rows } = await db.query(`${select} ORDER BY ${ordenarPor}`);
      return rows;
    },

    async get(llaves) {
      const { rows } = await db.query(`${select} WHERE ${whereLlave}`, llaves);
      return rows[0] ?? null;
    },

    async create(datos, cliente) {
      const ph = columnas.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await (cliente ?? db).query(
        `INSERT INTO ${id(tabla)} (${columnas.map(id).join(', ')}) VALUES (${ph}) RETURNING *`,
        valores(datos, columnas),
      );
      return recargar(rows[0], cliente);
    },

    async update(llaves, datos) {
      const sets = noLlave.map((c, i) => `${id(c)} = $${llave.length + i + 1}`).join(', ');
      const where = llave.map((k, i) => `${id(k)} = $${i + 1}`).join(' AND ');
      const { rows } = await db.query(
        `UPDATE ${id(tabla)} SET ${sets} WHERE ${where} RETURNING *`,
        [...llaves, ...valores(datos, noLlave)],
      );
      return rows[0] ? recargar(rows[0]) : null;
    },

    async remove(llaves) {
      const where = llave.map((k, i) => `${id(k)} = $${i + 1}`).join(' AND ');
      const { rowCount } = await db.query(`DELETE FROM ${id(tabla)} WHERE ${where}`, llaves);
      return rowCount > 0;
    },

    // Inserta o actualiza según la restricción única del recurso (usado por la importación).
    // Devuelve { insertado } para el resumen de la carga.
    async upsert(datos, cliente) {
      const ph = columnas.map((_, i) => `$${i + 1}`).join(', ');
      const actualizables = columnas.filter((c) => !conflicto.includes(c) && !llave.includes(c));
      const accion = actualizables.length
        ? `DO UPDATE SET ${actualizables.map((c) => `${id(c)} = EXCLUDED.${id(c)}`).join(', ')}`
        : 'DO NOTHING';
      const { rows } = await (cliente ?? db).query(
        `INSERT INTO ${id(tabla)} (${columnas.map(id).join(', ')}) VALUES (${ph})
         ON CONFLICT (${conflicto.map(id).join(', ')}) ${accion}
         RETURNING (xmax = 0) AS insertado`,
        valores(datos, columnas),
      );
      return { insertado: rows[0]?.insertado ?? false };
    },
  };
};

module.exports = crudRepository;
