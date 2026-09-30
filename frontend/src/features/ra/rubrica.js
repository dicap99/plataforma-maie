// Cálculo en vivo de la rúbrica mientras el docente escribe. Replica backend/src/modules/ra/rubrica.js
// con los umbrales que envía el API (`niveles`); el servidor recalcula y es la fuente de verdad.

const centesimas = (x) => Math.round(x * 100)

// Color por nivel: verde (Alto) → azul → ámbar → rojo (Insuficiente), en el orden de la rúbrica.
export const COLOR_NIVEL = {
  Alto: '#1e7b34',
  Medio: '#2a78d6',
  Basico: '#eda100',
  Insuficiente: '#ba1a1a',
}

export const etiquetaNivel = (niveles, nivel) => niveles.find((n) => n.nivel === nivel)?.etiqueta ?? nivel

export const esNota = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 5 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-9

export const nivelDeNota = (niveles, nota) => {
  if (typeof nota !== 'number' || !(nota >= 0 && nota <= 5)) return null
  const r = Math.round((nota + Number.EPSILON) * 100) / 100
  return niveles.find((n) => r >= n.min)?.nivel ?? null
}

// notas: { id_criterio: número }. Devuelve { total, nivel, completo }.
export const resultadoRA = (niveles, criterios, notas) => {
  let suma = 0
  let completo = criterios.length > 0
  for (const c of criterios) {
    const nota = notas[c.id_criterio]
    if (!esNota(nota)) {
      completo = false
      continue
    }
    suma += centesimas(nota) * centesimas(Number(c.peso_porcentaje))
  }
  if (!completo) return { total: null, nivel: null, completo: false }
  const total = Math.floor((suma + 5000) / 10000) / 100
  return { total, nivel: nivelDeNota(niveles, total), completo: true }
}

// Texto de la celda → número (acepta coma decimal), null si está vacía o undefined si no es válida.
export const leerNota = (texto) => {
  const t = String(texto ?? '').trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return esNota(n) ? n : undefined
}
