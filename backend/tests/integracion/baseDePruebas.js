// globalSetup de las pruebas de integración: recrea desde database/init.sql + seed.sql las bases
// "maie_test" (Módulo 1, parte vacía) y "maie_test_ra" (Módulo 2, se llena con datos sintéticos).
// Van separadas porque modulo1.test.js cuenta usuarios y promociones exactos.
// Requiere el PostgreSQL de Docker: `docker compose up -d db`.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const URL_PRUEBAS =
  process.env.TEST_DATABASE_URL || 'postgres://maie_admin:SecretPassword2026@localhost:5432/maie_test';

const URL_PRUEBAS_RA = process.env.TEST_DATABASE_URL_RA || URL_PRUEBAS.replace(/\/([^/]+)$/, '/$1_ra');

const recrear = async (url) => {
  const nombre = new URL(url).pathname.slice(1);
  const admin = new Client({ connectionString: url.replace(/\/[^/]+$/, '/postgres') });
  try {
    await admin.connect();
  } catch (err) {
    throw new Error(`No hay conexión con PostgreSQL (${err.message}). Ejecute: docker compose up -d db`);
  }
  await admin.query(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${nombre}"`);
  await admin.end();

  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  for (const archivo of ['init.sql', 'seed.sql']) {
    await cliente.query(fs.readFileSync(path.join(__dirname, '../../../database', archivo), 'utf8'));
  }
  await cliente.end();
};

module.exports = async () => {
  for (const url of [URL_PRUEBAS, URL_PRUEBAS_RA]) await recrear(url);
};

module.exports.URL_PRUEBAS = URL_PRUEBAS;
module.exports.URL_PRUEBAS_RA = URL_PRUEBAS_RA;
