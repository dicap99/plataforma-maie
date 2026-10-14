import { useState } from 'react'

// Contenedor estándar para figuras. `tabla` = { columnas: [{ clave, titulo, formato? }], filas } ofrece
// la vista de tabla accesible de los mismos datos (identidad nunca solo por color). `acciones`: controles
// de la gráfica (selectores, alternadores) en la cabecera.
export default function ChartCard({ titulo, subtitulo, children, tabla, altura = 'h-72', acciones, pie }) {
  const [verTabla, setVerTabla] = useState(false)

  return (
    <section className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="m-0 font-display text-headline-sm text-primary">{titulo}</h3>
          {subtitulo && <p className="m-0 text-body-sm text-on-surface-variant">{subtitulo}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {acciones}
        {tabla && (
          <button
            type="button"
            className="shrink-0 rounded-lg border border-outline-variant px-2 py-1 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container"
            onClick={() => setVerTabla((v) => !v)}
            aria-pressed={verTabla}
          >
            {verTabla ? 'Ver gráfica' : 'Ver tabla'}
          </button>
        )}
        </div>
      </header>
      {verTabla && tabla ? (
        <div className="tabla-scroll">
          <table className="text-body-sm">
            <thead>
              <tr>{tabla.columnas.map((c) => <th key={c.clave}>{c.titulo}</th>)}</tr>
            </thead>
            <tbody>
              {tabla.filas.map((f, i) => (
                <tr key={i}>
                  {tabla.columnas.map((c) => (
                    <td key={c.clave} className="tabular-nums">{c.formato ? c.formato(f[c.clave]) : f[c.clave]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`w-full ${altura}`}>{children}</div>
      )}
      {pie && <div className="mt-2 text-body-sm text-on-surface-variant">{pie}</div>}
    </section>
  )
}
