const { responder, descargar } = require('../controlador');
const service = require('./pregrado.service');

module.exports = {
  listar: responder(service.listar), // GET /eval-docente/pregrado
  plantilla: descargar(service.plantilla), // GET /eval-docente/pregrado/plantilla
  // POST /eval-docente/pregrado/importar — 200 al validar (simular), 201 al confirmar
  importar: responder(service.importar, (r) => (r.simulacion ? 200 : 201)),
  cambiarEstado: responder(service.cambiarEstado), // PUT /eval-docente/pregrado/:idCurso/:idEstudiante
  quitar: responder(service.quitar), // DELETE /eval-docente/pregrado/:idCurso/:idEstudiante
};
