// Beneficios de un estudiante en cada semestre de su promoción (reunión de avances del 20-oct-2026).
// `columna` es la de la hoja «Beneficios» que cuenta a los estudiantes con ese beneficio. Las becas
// (`beca: true`) son excluyentes en un semestre; asistencias y ayudantías se pueden sumar a una beca.
const TIPOS_BENEFICIO = [
  { valor: '100', etiqueta: 'Beca 100 %', columna: 'becas_100', beca: true },
  { valor: 'hora_catedra', etiqueta: 'Beca hora cátedra', columna: 'becas_hora_catedra', beca: true },
  { valor: 'sintraunicol', etiqueta: 'Beca SINTRAUNICOL', columna: 'becas_sintraunicol', beca: true },
  { valor: 'asistente_investigacion', etiqueta: 'Asistente de investigación', columna: 'asistentes_investigacion', beca: false },
  { valor: 'ayudante_docencia', etiqueta: 'Ayudante de docencia', columna: 'ayudantes_docencia', beca: false },
];
const VALORES_BENEFICIO = TIPOS_BENEFICIO.map((t) => t.valor);
const ES_BECA = new Set(TIPOS_BENEFICIO.filter((t) => t.beca).map((t) => t.valor));

// Beca que resume las de cada semestre en cohorte_estudiantes.beca: la de más semestres (empate: la primera).
const becaPrincipal = (beneficios) => {
  const cuenta = new Map();
  for (const b of [...beneficios].sort((x, y) => x.semestre - y.semestre)) {
    if (ES_BECA.has(b.tipo)) cuenta.set(b.tipo, (cuenta.get(b.tipo) ?? 0) + 1);
  }
  let mejor = null;
  for (const [tipo, n] of cuenta) if (!mejor || n > cuenta.get(mejor)) mejor = tipo;
  return mejor;
};

// Semestres con más de una beca (no válido).
const semestresConVariasBecas = (beneficios) => {
  const porSemestre = new Map();
  for (const b of beneficios) if (ES_BECA.has(b.tipo)) porSemestre.set(b.semestre, (porSemestre.get(b.semestre) ?? 0) + 1);
  return [...porSemestre].filter(([, n]) => n > 1).map(([s]) => s).sort();
};

module.exports = { TIPOS_BENEFICIO, VALORES_BENEFICIO, ES_BECA, becaPrincipal, semestresConVariasBecas };
