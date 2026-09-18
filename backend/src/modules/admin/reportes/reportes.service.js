// RF-ADM-05 — Reportes estadísticos administrativos (datos para las gráficas de autoevaluación)
const { RECURSOS } = require('../recursos/recursos.definicion');
const repositorios = require('../recursos/recursos.repository');
const estadisticas = require('./estadisticas');

const cargarTodo = async () => {
  const listas = await Promise.all(RECURSOS.map((r) => repositorios[r.id].list()));
  return Object.fromEntries(RECURSOS.map((r, i) => [r.id, listas[i]]));
};

module.exports = {
  // Todas las secciones del informe administrativo.
  estadisticas: async () => estadisticas.calcular(await cargarTodo()),

  // Consolidado presupuestal por promoción (corte más reciente).
  async resumenPresupuesto() {
    const [filas, parametros] = await Promise.all([repositorios.presupuesto.list(), repositorios.parametros.list()]);
    return estadisticas.presupuesto(filas, Object.fromEntries(parametros.map((p) => [p.clave, p.valor])));
  },
};
