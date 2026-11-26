// RF-ADM-05 — Reportes estadísticos administrativos (datos para las gráficas de autoevaluación)
const { RECURSOS } = require('../recursos/recursos.definicion');
const repositorios = require('../recursos/recursos.repository');
const estadisticas = require('./estadisticas');
const reflejo = require('./reflejo');
const alertas = require('./alertas');
const db = require('../../../config/db');
const periodosRA = require('../../ra/periodos/periodos.repository');
const avanceRA = require('../../ra/periodos/avance');

const cargarTodo = async () => {
  const listas = await Promise.all(RECURSOS.map((r) => repositorios[r.id].list()));
  return Object.fromEntries(RECURSOS.map((r, i) => [r.id, listas[i]]));
};

module.exports = {
  // Todas las secciones del informe administrativo (con el reflejo de Gestión académica) y las
  // alertas del Panel general.
  async estadisticas() {
    const [datos, periodos, calificacion] = await Promise.all([
      cargarTodo().then(reflejo.aplicar),
      // Cronograma de la evaluación docente (Módulo 3): un semestre publicado ya no genera alertas.
      db.query(`SELECT periodo AS codigo_periodo, fecha_apertura, fecha_cierre, NOT publicado AS activo
                FROM evaluacion_periodos`).then((r) => r.rows),
      // Calificación de rúbricas abierta con cursos incompletos (Módulo 2).
      periodosRA.avanceAbiertos().then(avanceRA.resumir),
    ]);
    const resultado = estadisticas.calcular(datos);
    return { ...resultado, alertas: alertas.calcular(resultado, periodos, new Date(), calificacion) };
  },

  // Hojas de Información académica que reflejan Gestión académica (promociones, beneficios y cursos
  // y docentes por semestre), con el origen de cada fila.
  async reflejoAcademico() {
    const ids = reflejo.RECURSOS_REFLEJADOS;
    const listas = await Promise.all(ids.map((id) => repositorios[id].list()));
    const combinado = await reflejo.aplicar(Object.fromEntries(ids.map((id, i) => [id, listas[i]])));
    return Object.fromEntries(ids.map((id) => [id, combinado[id]]));
  },

  // Hojas financieras con su reflejo: «Contrataciones» (desde «Contratos OPS»), «Estudiantes de pregrado»
  // (cuando hay matrícula financiera de pregrado) y el recaudo acumulado por promoción.
  async reflejoFinanciero() {
    const [contrataciones, pregrado, cohortes] = await Promise.all([
      repositorios.contrataciones.list(),
      repositorios.pregrado.list(),
      repositorios.cohortes.list(),
    ]);
    return reflejo.aplicarFinanciero({ contrataciones, pregrado, cohortes });
  },

  // Consolidado presupuestal por promoción (corte más reciente), comparado con su proyección y recaudo por matrículas.
  async resumenPresupuesto() {
    const [filas, parametros, equilibrio, recaudo] = await Promise.all([
      repositorios.presupuesto.list(),
      repositorios.parametros.list(),
      repositorios['punto-equilibrio'].list(),
      reflejo.recaudoMatriculas(),
    ]);
    const resumen = estadisticas.presupuesto(filas, Object.fromEntries(parametros.map((p) => [p.clave, p.valor])), equilibrio);
    return { ...resumen, recaudo_matriculas: recaudo };
  },
};
