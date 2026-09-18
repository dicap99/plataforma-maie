// globalSetup de las pruebas de integración: recrea la base "maie_test" desde database/init.sql + seed.sql.
// Requiere el PostgreSQL de Docker: `docker compose up -d db`.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const URL_PRUEBAS =
  process.env.TEST_DATABASE_URL || 'postgres://maie_admin:SecretPassword2026@localhost:5432/maie_test';

module.exports = async () => {
  const nombre = new URL(URL_PRUEBAS).pathname.slice(1);
  const admin = new Client({ connectionString: URL_PRUEBAS.replace(/\/[^/]+$/, '/postgres') });
  try {
    await admin.connect();
  } catch (err) {
    throw new Error(`No hay conexión con PostgreSQL (${err.message}). Ejecute: docker compose up -d db`);
  }
  await admin.query(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${nombre}"`);
  await admin.end();

  const cliente = new Client({ connectionString: URL_PRUEBAS });
  await cliente.connect();
  for (const archivo of ['init.sql', 'seed.sql']) {
    await cliente.query(fs.readFileSync(path.join(__dirname, '../../../database', archivo), 'utf8'));
  }
  await cliente.end();
};

module.exports.URL_PRUEBAS = URL_PRUEBAS;
