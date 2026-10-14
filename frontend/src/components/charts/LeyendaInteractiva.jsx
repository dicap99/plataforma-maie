import { useState } from 'react'

// Estado de series ocultas para una gráfica con leyenda interactiva. Nunca deja ocultar la última
// serie visible, para que la gráfica no quede vacía.
export function useSeriesOcultas(total) {
  const [ocultas, setOcultas] = useState(() => new Set())
  const alternar = (clave) =>
    setOcultas((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(clave)) nuevo.delete(clave)
      else if (total - nuevo.size > 1) nuevo.add(clave)
      return nuevo
    })
  return { ocultas, alternar }
}

// Leyenda de botones: un clic muestra u oculta la serie. Es accesible con teclado (aria-pressed) y la
// identidad de cada serie no depende solo del color (muestra y nombre).
export default function LeyendaInteractiva({ items, ocultas, onAlternar, forma = 'cuadro' }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-1 gap-y-1 pt-2" role="group" aria-label="Series de la gráfica (clic para mostrar u ocultar)">
      {items.map((it) => {
        const oculta = ocultas.has(it.clave)
        return (
          <button
            key={it.clave}
            type="button"
            aria-pressed={!oculta}
            title={oculta ? `Mostrar ${it.nombre}` : `Ocultar ${it.nombre}`}
            onClick={() => onAlternar(it.clave)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-label-sm transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary ${
              oculta ? 'text-outline line-through' : 'text-on-surface-variant'
            }`}
          >
            <span
              aria-hidden="true"
              className={forma === 'linea' ? 'h-0.5 w-3.5 rounded-full' : forma === 'circulo' ? 'h-2.5 w-2.5 rounded-full' : 'h-2.5 w-2.5 rounded-sm'}
              style={{ backgroundColor: oculta ? 'transparent' : it.color, boxShadow: `inset 0 0 0 1.5px ${it.color}` }}
            />
            {it.nombre}
          </button>
        )
      })}
    </div>
  )
}
