// Tipos de beneficio de un estudiante por semestre (réplica de backend/src/utils/beneficios.js).
// Las becas son excluyentes en un semestre; asistencias y ayudantías se suman a la beca.
export const BECAS = [
  { valor: '100', etiqueta: 'Beca 100 %' },
  { valor: 'hora_catedra', etiqueta: 'Beca hora cátedra' },
  { valor: 'sintraunicol', etiqueta: 'Beca SINTRAUNICOL' },
]
export const AYUDAS = [
  { valor: 'asistente_investigacion', etiqueta: 'Asistente de investigación' },
  { valor: 'ayudante_docencia', etiqueta: 'Ayudante de docencia' },
]
export const SEMESTRES = [1, 2, 3, 4]
export const ROMANOS = ['I', 'II', 'III', 'IV']

const ETIQUETAS = Object.fromEntries([...BECAS, ...AYUDAS].map((t) => [t.valor, t.etiqueta]))
export const etiquetaBeneficio = (tipo) => ETIQUETAS[tipo] ?? tipo
export const etiquetaBeca = (beca) => BECAS.find((b) => b.valor === beca)?.etiqueta ?? '—'
