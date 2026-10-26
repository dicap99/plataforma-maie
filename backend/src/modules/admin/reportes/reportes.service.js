// RF-ADM-05 — Reportes estadísticos administrativos (datos para las gráficas de autoevaluación)
const { RECURSOS } = require('../recursos/recursos.definicion');
const repositorios = require('../recursos/recursos.repository');
const estadisticas = require('./estadisticas');
const reflejo = require('./reflejo');
const alertas = require('./alertas');
const db = require('../../../config/db');

const cargarTodo = async () => {
  const listas = await Promise.all(RECURSOS.map((r) => repositorios[r.id].list()));
  return Object.fromEntries(RECURSOS.map((r, i) => [r.id, listas[i]]));
};

module.exports = {
  // Todas las secciones del informe administrativo (con el reflejo de Gestión académica) y las
  // alertas del Panel general.
  async estadisticas() {
    const [datos, periodos] = await Promise.all([
      cargarTodo().then(reflejo.aplicar),
      db.query('SELECT codigo_periodo, fecha_apertura, fecha_cierre, activo FROM evaluacion_periodos').then((r) => r.rows),
    ]);
    const resultado = estadisticas.calcular(datos);
    return { ...resultado, alertas: alertas.calcular(resultado, periodos) };
  },

  // Hojas de Información académica que reflejan Gestión académica (promociones, beneficios y cursos
  // y docentes por semestre), con el origen de cada fila.
  async reflejoAcademico() {
    const ids = reflejo.RECURSOS_REFLEJADOS;
    const listas = await Promise.all(ids.map((id) => repositorios[id].list()));
    const combinado = await reflejo.aplicar(Object.fromEntries(ids.map((id, i) => [id, listas[i]])));
    return Object.fromEntries(ids.map((id) => [id, combinado[id]]));
  },

  // Consolidado presupuestal por promoción (corte más reciente), comparado con su proyección.
  async resumenPresupuesto() {
    const [filas, parametros, equilibrio] = await Promise.all([
      repositorios.presupuesto.list(),
      repositorios.parametros.list(),
      repositorios['punto-equilibrio'].list(),
    ]);
    return estadisticas.presupuesto(filas, Object.fromEntries(parametros.map((p) => [p.clave, p.valor])), equilibrio);
  },
};
