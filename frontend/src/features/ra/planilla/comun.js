// Utilidades compartidas por las vistas de la planilla de rúbricas.
import { leerNota, resultadoRA } from '../rubrica'

export const clave = (idEstudiante, idCriterio) => `${idEstudiante}|${idCriterio}`

// Descriptor de cada nivel en la fila del criterio, del más bajo al más alto (orden del mockup).
export const NIVELES_CRITERIO = [
  { nivel: 'Insuficiente', campo: 'desc_nivel_insuficiente', sugerida: 2.5 },
  { nivel: 'Basico', campo: 'desc_nivel_basico', sugerida: 3.2 },
  { nivel: 'Medio', campo: 'desc_nivel_medio', sugerida: 4.0 },
  { nivel: 'Alto', campo: 'desc_nivel_alto', sugerida: 4.8 },
]

export const nombreEstudiante = (e) => `${e.nombres} ${e.apellidos}`
export const iniciales = (e) => `${e.nombres[0] ?? ''}${e.apellidos[0] ?? ''}`.toUpperCase()

// Texto visible de una celda: lo que el docente escribió o la nota guardada.
export const textoNota = (ediciones, e, c) => {
  const k = clave(e.id_estudiante, c.id_criterio)
  if (k in ediciones) return ediciones[k]
  const nota = e.notas[c.id_criterio]
  return nota === undefined || nota === null ? '' : String(nota)
}

// Notas del estudiante con las ediciones sin guardar aplicadas (las inválidas no cuentan).
export const notasVivas = (ediciones, e, criterios) => {
  const notas = { ...e.notas }
  for (const c of criterios) {
    const k = clave(e.id_estudiante, c.id_criterio)
    if (k in ediciones) notas[c.id_criterio] = leerNota(ediciones[k]) ?? undefined
  }
  return notas
}

// Estado del estudiante en el RA: pendiente, parcial, calificado o en riesgo (< 3.0).
export const estadoEstudiante = (niveles, ediciones, e, criterios) => {
  const notas = notasVivas(ediciones, e, criterios)
  const r = resultadoRA(niveles, criterios, notas)
  const registradas = criterios.filter((c) => typeof notas[c.id_criterio] === 'number').length
  let estado = 'pendiente'
  if (r.completo) estado = r.nivel === 'Insuficiente' ? 'riesgo' : 'calificado'
  else if (registradas > 0) estado = 'parcial'
  return { ...r, estado, registradas }
}

export const ESTADOS = {
  pendiente: { etiqueta: 'Pendiente', clase: 'bg-surface-container-high text-on-surface-variant' },
  parcial: { etiqueta: 'Parcial', clase: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' },
  calificado: { etiqueta: 'Calificado', clase: 'bg-secondary-fixed text-on-secondary-fixed-variant' },
  riesgo: { etiqueta: 'En riesgo', clase: 'bg-error-container text-on-error-container' },
}
