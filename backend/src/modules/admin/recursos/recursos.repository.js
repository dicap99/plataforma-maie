// Un repositorio CRUD por recurso declarativo (ver recursos.definicion.js).
const crudRepository = require('../../../shared/crud/crudRepository');
const { RECURSOS } = require('./recursos.definicion');

module.exports = Object.fromEntries(RECURSOS.map((r) => [r.id, crudRepository(r)]));
