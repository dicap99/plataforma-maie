// Piezas compartidas por los paneles de gráficas de «Información académica».

// Selector segmentado (p. ej. «Cantidad | %»).
export function Alternador({ opciones, valor, onChange, etiqueta }) {
  return (
    <div className="inline-flex items-center rounded-xl bg-surface-container-low p-1 text-label-sm" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor} onClick={() => onChange(o.valor)}
          className={`rounded-lg px-2.5 py-1 transition-colors ${valor === o.valor ? 'bg-surface-container-lowest font-semibold text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}

// Fila de tarjetas de indicadores.
export function FilaIndicadores({ children }) {
  return <section className="grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">{children}</section>
}

// Rejilla de gráficas (dos columnas en pantallas anchas).
export function RejillaGraficas({ children }) {
  return <div className="grid grid-cols-1 gap-gutter xl:grid-cols-2">{children}</div>
}

// Controles sobre una gráfica (selectores y alternadores) alineados a la derecha.
export function Controles({ children }) {
  return <div className="mb-2 flex flex-wrap items-center justify-end gap-2">{children}</div>
}

export function SinDatos({ texto = 'No hay datos para mostrar con este rango de promociones.' }) {
  return <p className="grid h-full place-items-center text-body-sm text-on-surface-variant">{texto}</p>
}

export function Pista({ children }) {
  return <p className="mt-2 text-body-sm text-on-surface-variant">{children}</p>
}
