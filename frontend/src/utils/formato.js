// Formatos numéricos en español de Colombia.
const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
const moneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const monedaCompacta = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1,
})
const pct = new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 1 })

const vacio = (v) => v === null || v === undefined || Number.isNaN(v)

export const numero = (v) => (vacio(v) ? '—' : nf.format(v))
export const pesos = (v) => (vacio(v) ? '—' : moneda.format(v))
export const pesosCompactos = (v) => (vacio(v) ? '—' : monedaCompacta.format(v))
export const porcentaje = (v) => (vacio(v) ? '—' : pct.format(v))

// Valor de una celda según el tipo de campo del recurso.
export const valorCampo = (campo, v) => {
  if (vacio(v) || v === '') return '—'
  if (campo.type === 'dinero') return pesos(v)
  if (campo.type === 'entero' || campo.type === 'numero') return numero(v)
  return String(v)
}
