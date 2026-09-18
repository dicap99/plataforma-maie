// RF-ADM-02 — Plantillas de importación .xlsx
// Lógica de negocio del sub-módulo; el acceso a datos va en ./plantillas.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Tipos de plantilla disponibles.
  listar: pendiente('plantillas.listar'),
  // Descarga la plantilla .xlsx pre-configurada (generada con exceljs).
  descargar: pendiente('plantillas.descargar'),
};
