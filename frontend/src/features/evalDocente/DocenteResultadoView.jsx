import PendienteAviso from '../../components/common/PendienteAviso.jsx'

// Vista de solo lectura del informe propio del docente (RF-EVAL-05, GET /eval-docente/resultados/me).
// resultado: { periodo, indicadores: { porcentaje_ip, indicador_negativo_in, categorizacion } }
export default function DocenteResultadoView({ resultado }) {
  return (
    <>
      <h1>Mis resultados de evaluación</h1>
      <PendienteAviso requisito="RF-EVAL-05 — disponible cuando Coordinación publique el periodo" />
      {resultado ? (
        <div className="grid-tarjetas">
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Periodo {resultado.periodo}</p>
            <p className="text-4xl font-bold text-sky-800">{resultado.indicadores.porcentaje_ip}%</p>
            <p className="text-sm text-slate-500">Indicador Positivo (%IP)</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Categorización</p>
            <p className="text-2xl font-semibold text-slate-800">{resultado.indicadores.categorizacion}</p>
          </article>
        </div>
      ) : (
        <p className="texto-suave">Aún no hay resultados publicados.</p>
      )}
    </>
  )
}
