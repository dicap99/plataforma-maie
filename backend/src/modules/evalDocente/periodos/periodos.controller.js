const { responder } = require('../controlador');
const service = require('./periodos.service');

module.exports = {
  listar: responder(service.listar), // GET /eval-docente/periodos
  obtener: responder(service.obtener), // GET /eval-docente/periodos/:periodo
  cambiar: responder(service.cambiar), // PUT /eval-docente/periodos/:periodo
  publicar: responder(service.publicar), // POST /eval-docente/periodos/:periodo/publicacion
};
