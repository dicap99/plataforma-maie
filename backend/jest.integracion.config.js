// Pruebas de integración contra PostgreSQL real (requiere `docker compose up -d db`).
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integracion/**/*.test.js'],
  globalSetup: '<rootDir>/tests/integracion/baseDePruebas.js',
  setupFiles: ['<rootDir>/tests/integracion/entorno.js'],
  testTimeout: 30000,
};
