// RF-ADM-05 — Reportes estadísticos administrativos (datos para las gráficas de autoevaluación)
const { RECURSOS } = require('../recursos/recursos.definicion');
const repositorios = require('../recursos/recursos.repository');
const estadisticas = require('./estadisticas');
const reflejo = require('./reflejo');

const cargarTodo = async () => {
  const listas = await Promise.all(RECURSOS.map((r) => repositorios[r.id].list()));
  return Object.fromEntries(RECURSOS.map((r, i) => [r.id, listas[i]]));
};

module.exports = {
  // Todas las secciones del informe administrativo (con el reflejo de Gestión académica).
  estadisticas: async () => estadisticas.calcular(await reflejo.aplicar(await cargarTodo())),

  // Hojas de Información académica que reflejan Gestión académica (promociones, beneficios y cursos
  // y docentes por semestre), con el origen de cada fila.
  async reflejoAcademico() {
    const ids = reflejo.RECURSOS_REFLEJADOS;
    const listas = await Promise.all(ids.map((id) => repositorios[id].list()));
    const combinado = await reflejo.aplicar(Object.fromEntries(ids.map((id, i) => [id, listas[i]])));
    return Object.fromEntries(ids.map((id) => [id, combinado[id]]));
  },

  // Consolidado presupuestal por promoción (corte más reciente).
  async resumenPresupuesto() {
    const [filas, parametros] = await Promise.all([repositorios.presupuesto.list(), repositorios.parametros.list()]);
    return estadisticas.presupuesto(filas, Object.fromEntries(parametros.map((p) => [p.clave, p.valor])));
  },
};
