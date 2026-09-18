// setupFiles: apunta la aplicación a la base de pruebas antes de cargarla.
const { URL_PRUEBAS } = require('./baseDePruebas');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = URL_PRUEBAS;
process.env.JWT_SECRET = 'secreto-pruebas-integracion';
