import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import StatTile from '../../components/charts/StatTile.jsx'
import { pesos, pesosCompactos, porcentaje } from '../../utils/formato'

// Ejecución presupuestal por promoción (RF-ADM-03, GET /admin/presupuesto/resumen).
// Medidor: el relleno muestra lo comprometido sobre los ingresos; el riel es un tono claro del mismo color.
export default function PresupuestoDashboard() {
  const { data, error, cargando, recargar } = useApi(adminApi.resumenPresupuesto)

  if (cargando && !data) return <Cargando />
  if (error) return <ErrorApi error={error} onReintentar={recargar} />

  return (
    <>
      <header className="encabezado-pagina">
        <h1>Ejecución presupuestal</h1>
        <p className="texto-suave">Corte {data.fecha_corte ?? '—'} · valores registrados en «Datos del programa › Presupuesto»</p>
      </header>

      {data.filas.length === 0 ? (
        <p className="texto-suave">No hay registros de presupuesto.</p>
      ) : (
        <>
          <div className="grid-indicadores">
            <StatTile etiqueta="Ingresos" valor={pesosCompactos(data.totales.ingresos)} detalle={pesos(data.totales.ingresos)} />
            <StatTile etiqueta="Gastos comprometidos" valor={pesosCompactos(data.totales.gastos_comprometidos)} detalle={pesos(data.totales.gastos_comprometidos)} />
            <StatTile etiqueta="Saldo" valor={pesosCompactos(data.totales.saldo_comprometido)} detalle={`Ejecución ${porcentaje(data.indicadores.pct_ejecucion)}`} />
          </div>

          <div className="grid-tarjetas">
            {data.filas.map((f) => {
              const pct = Math.max(0, Math.min(1, f.pct_ejecucion ?? 0))
              const sobregiro = (f.pct_ejecucion ?? 0) > 1
              return (
                <article key={f.id_presupuesto} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-800">Promoción {f.cohorte}</h3>
                  <div
                    className="mt-2 h-3 w-full overflow-hidden rounded-full bg-sky-100"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(pct * 100)}
                    aria-label={`Ejecución promoción ${f.cohorte}`}
                  >
                    <div className={`h-full rounded-full ${sobregiro ? 'bg-red-600' : 'bg-sky-700'}`} style={{ width: `${pct * 100}%` }} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {porcentaje(f.pct_ejecucion)} comprometido{sobregiro && ' · ⚠ gastos superan los ingresos'}
                  </p>
                  <dl className="lista-valores">
                    <dt>Ingresos</dt><dd>{pesos(f.ingresos)}</dd>
                    <dt>Gastos comprometidos</dt><dd>{pesos(f.gastos_comprometidos)}</dd>
                    <dt>Saldo</dt><dd>{pesos(f.saldo_comprometido)}</dd>
                    <dt>Transferencia Central</dt><dd>{pesos(f.transferencia_central)}</dd>
                    <dt>Transferencia VIIS</dt><dd>{pesos(f.transferencia_viis)}</dd>
                    <dt>Fondo de Investigaciones</dt><dd>{pesos(f.fondo_investigaciones)}</dd>
                    <dt>Unidad Académica</dt><dd>{pesos(f.unidad_academica)}</dd>
                  </dl>
                </article>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
