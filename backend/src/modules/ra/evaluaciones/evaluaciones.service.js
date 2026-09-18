// RF-RA-02 — Registro de calificaciones por rúbrica
// Lógica de negocio del sub-módulo; el acceso a datos va en ./evaluaciones.repository.js
const pendiente = require('../../../utils/pendiente');

module.exports = {
  // Calificaciones de un curso (?curso=); el docente solo ve sus cursos, Coordinación audita.
  listar: pendiente('evaluaciones.listar'),
  // Registro en lote de niveles por estudiante y criterio (solo cursos propios).
  registrarLote: pendiente('evaluaciones.registrarLote'),
  // Corrección de una calificación registrada.
  actualizar: pendiente('evaluaciones.actualizar'),
};
