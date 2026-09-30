// RF-RA-02 — Apertura de la calificación de rúbricas por semestre académico.
// Cada curso se evalúa al final de su semestre; Coordinación abre y cierra la calificación
// de todos los cursos de un semestre a la vez.
const repository = require('./periodos.repository');

module.exports = {
  listar: () => repository.list(),

  cambiar: ({ params, body, user }) => repository.guardar(params.periodo, body.abierto, user.id),
};
