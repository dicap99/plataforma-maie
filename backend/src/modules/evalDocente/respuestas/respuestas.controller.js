const { responder } = require('../controlador');
const { MATRIZ, CASOS_BORDE } = require('../categorizacion');
const service = require('./respuestas.service');

module.exports = {
  formulario: responder(service.formulario), // GET /eval-docente/formularios/:tipo
  categorizacion: responder(async () => ({ matriz: MATRIZ, casos_borde: CASOS_BORDE })), // GET /eval-docente/categorizacion
  pendientes: responder(service.pendientes), // GET /eval-docente/pendientes
  registrar: responder(service.registrar, 201), // POST /eval-docente/respuestas
  propia: responder(service.propia), // GET /eval-docente/respuestas/propia
};
