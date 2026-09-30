import { COLOR_NIVEL } from './rubrica'

const ETIQUETAS = { Alto: 'Alto', Medio: 'Medio', Basico: 'Básico', Insuficiente: 'Insuficiente' }

// Píldora con el nivel de logro de la rúbrica (el color acompaña al texto, nunca lo sustituye).
export default function NivelInsignia({ nivel, total }) {
  if (!nivel) return <span className="text-body-sm text-on-surface-variant">—</span>
  const color = COLOR_NIVEL[nivel]
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-label-sm font-bold"
      style={{ color, backgroundColor: `${color}1a` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {total !== undefined && total !== null && <span>{total.toFixed(2)}</span>}
      {ETIQUETAS[nivel] ?? nivel}
    </span>
  )
}
