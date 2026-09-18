import PendienteAviso from '../../components/common/PendienteAviso.jsx'

// Tablero de ejecución presupuestal por rubro (RF-ADM-03, GET /admin/presupuesto/resumen).
// rubros: [{ concepto, asignado, comprometido, ejecutado }]
export default function PresupuestoDashboard({ rubros = [] }) {
  return (
    <>
      <h1>Ejecución presupuestal</h1>
      <PendienteAviso requisito="RF-ADM-03 — conectar con /admin/presupuesto/resumen" />
      <div className="grid-tarjetas">
        {rubros.map((r) => {
          const pct = r.asignado > 0 ? Math.min(100, (r.ejecutado / r.asignado) * 100) : 0
          return (
            <article key={r.concepto} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800">{r.concepto}</h3>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-700" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{pct.toFixed(1)} % ejecutado</p>
            </article>
          )
        })}
      </div>
    </>
  )
}
