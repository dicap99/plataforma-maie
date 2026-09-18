import { useState } from 'react'

// Contenedor estándar para figuras. `tabla` = { columnas: [{ clave, titulo, formato? }], filas } ofrece
// la vista de tabla accesible de los mismos datos (identidad nunca solo por color).
export default function ChartCard({ titulo, subtitulo, children, tabla, altura = 'h-72' }) {
  const [verTabla, setVerTabla] = useState(false)

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-800">{titulo}</h3>
          {subtitulo && <p className="text-sm text-slate-500">{subtitulo}</p>}
        </div>
        {tabla && (
          <button
            type="button"
            className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            onClick={() => setVerTabla((v) => !v)}
            aria-pressed={verTabla}
          >
            {verTabla ? 'Ver gráfica' : 'Ver tabla'}
          </button>
        )}
      </header>
      {verTabla && tabla ? (
        <div className="tabla-scroll">
          <table className="text-sm">
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
    </section>
  )
}
