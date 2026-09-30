// RF-RA-01 — Estrategias de evaluación y RA en que se sugieren
const repository = require('./estrategias.repository');

module.exports = {
  listar: () => repository.list(),
};
