const { Pool } = require('pg');
const env = require('./env');

// Pool único compartido por todos los repositorios.
const pool = new Pool({ connectionString: env.databaseUrl });

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
