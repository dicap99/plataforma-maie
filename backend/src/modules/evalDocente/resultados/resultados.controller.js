const { responder, descargar } = require('../controlador');
const service = require('./resultados.service');

module.exports = {
  consolidado: responder(service.consolidado), // GET /eval-docente/resultados
  propios: responder(service.propios), // GET /eval-docente/resultados/me
  porDocente: responder(service.porDocente), // GET /eval-docente/resultados/docentes/:idDocente
  exportar: descargar(service.exportar), // GET /eval-docente/resultados/exportar
  informePdf: descargar(service.informePdf), // GET /eval-docente/resultados/informe.pdf
  informeDocentePdf: descargar(service.informeDocentePdf), // GET /eval-docente/resultados/docentes/:idDocente/informe.pdf
  informePropioPdf: descargar(service.informePropioPdf), // GET /eval-docente/resultados/me/informe.pdf
};
