// RF-RA-02 — Avance de la calificación de rúbricas en los semestres abiertos (función pura, sin BD).
// Lo usan la alerta del Panel general y el aviso de «Análisis del programa»: mientras un semestre está
// abierto y algún curso no tiene todas sus notas, los resultados de ese semestre son parciales.

// filas: [{ periodo, id_curso, id_cohorte, cohorte, curso, docentes: [nombre], esperadas, notas }]
// → [{ periodo, cursos, completos, notas, esperadas, pendientes: [{ ...curso, faltan }] }], solo semestres con pendientes.
const resumir = (filas = []) => {
  const porPeriodo = new Map();
  for (const f of filas) {
    if (!porPeriodo.has(f.periodo)) porPeriodo.set(f.periodo, []);
    porPeriodo.get(f.periodo).push(f);
  }
  return [...porPeriodo.entries()]
    .map(([periodo, cursos]) => {
      // Un curso sin estudiantes o sin rúbricas no tiene nada que calificar.
      const pendientes = cursos
        .filter((c) => c.esperadas > 0 && c.notas < c.esperadas)
        .map((c) => ({ ...c, faltan: c.esperadas - c.notas }));
      return {
        periodo,
        cursos: cursos.length,
        completos: cursos.length - pendientes.length,
        notas: cursos.reduce((s, c) => s + c.notas, 0),
        esperadas: cursos.reduce((s, c) => s + c.esperadas, 0),
        pendientes,
      };
    })
    .filter((p) => p.pendientes.length > 0);
};

// Limita el resumen a los filtros de un reporte (semestre y promoción), para no avisar de lo que no se consulta.
const filtrar = (resumen, { periodo, cohorte } = {}) =>
  resumen
    .filter((p) => !periodo || p.periodo === periodo)
    .map((p) => (cohorte ? { ...p, pendientes: p.pendientes.filter((c) => String(c.id_cohorte) === String(cohorte)) } : p))
    .filter((p) => p.pendientes.length > 0);

module.exports = { resumir, filtrar };
