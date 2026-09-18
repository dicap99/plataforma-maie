const { Pool, types } = require('pg');
const env = require('./env');

// NUMERIC (1700) y BIGINT (20) llegan como string por defecto; los montos del programa
// caben con holgura en un double, así que se devuelven como número al frontend.
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
// DATE (1082) como 'YYYY-MM-DD' para evitar corrimientos de zona horaria.
types.setTypeParser(1082, (v) => v);

// Pool único compartido por todos los repositorios.
const pool = new Pool({ connectionString: env.databaseUrl });

// Ejecuta fn(client) dentro de una transacción; hace ROLLBACK ante cualquier error.
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  withTransaction,
};
