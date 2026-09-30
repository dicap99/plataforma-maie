import Icono from '../../../components/common/Icono.jsx'

// Tarjeta de indicador del panel del coordinador: rótulo, cifra grande, icono y
// un pie libre (insignias, barra de progreso o texto de apoyo).
export default function TarjetaKpi({ etiqueta, valor, icono, destacado = false, children }) {
  return (
    <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-space-sm">
        <div className="min-w-0">
          <span className="text-label-sm font-semibold uppercase text-on-surface-variant">{etiqueta}</span>
          <div
            className={`mt-1 font-display text-headline-xl ${destacado ? 'text-secondary' : 'text-primary'}`}
          >
            {valor}
          </div>
        </div>
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-secondary ${
            destacado ? 'bg-secondary-container/20' : 'bg-surface-container-high'
          }`}
        >
          <Icono nombre={icono} />
        </span>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

// Insignia de apoyo para el pie de una tarjeta KPI.
export function Insignia({ tono = 'neutro', children }) {
  const tonos = {
    neutro: 'bg-surface-container-high text-on-tertiary-container',
    acento: 'bg-secondary-fixed text-on-secondary-fixed-variant',
    fuerte: 'bg-surface-variant text-primary',
  }
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-label-sm font-bold ${tonos[tono]}`}>
      {children}
    </span>
  )
}

// Barra de progreso para indicadores porcentuales (0–1).
export function BarraProgreso({ fraccion }) {
  const pct = Math.max(0, Math.min(1, fraccion ?? 0)) * 100
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
      <div
        className="h-full rounded-full bg-gradient-to-r from-secondary to-secondary-container"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
