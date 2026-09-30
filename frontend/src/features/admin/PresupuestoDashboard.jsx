import { useState } from 'react'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import StatTile from '../../components/charts/StatTile.jsx'
import { pesos, pesosCompactos, porcentaje } from '../../utils/formato'
import RecursoTabla from './RecursoTabla.jsx'
import CsvUploaderModal from './CsvUploaderModal.jsx'

export default function PresupuestoDashboard() {
  const [activo, setActivo] = useState('resumen')
  const [importando, setImportando] = useState(false)
  const [version, setVersion] = useState(0)

  const { data: resumenData, error: resumenError, cargando: resumenCargando, recargar: recargarResumen } = useApi(adminApi.resumenPresupuesto)
  const recursos = useApi(adminApi.listarRecursos)
  const cohortes = useApi(() => adminApi.listar('cohortes'))

  if ((resumenCargando && !resumenData) || (recursos.cargando && !recursos.data)) return <Cargando />
  if (resumenError) return <ErrorApi error={resumenError} onReintentar={recargarResumen} />
  if (recursos.error) return <ErrorApi error={recursos.error} onReintentar={recursos.recargar} />

  const lista = (recursos.data || []).filter(r => r.categoria === 'financiero')
  const recursoActual = lista.find(r => r.id === activo)
  const puedeEditar = lista.some(r => r.editable)

  return (
    <>
      <header className="encabezado-pagina">
        <h1>Presupuesto y finanzas</h1>
        {activo !== 'resumen' && puedeEditar && (
          <div className="acciones-pagina">
            <button type="button" className="btn btn-secundario" onClick={() => adminApi.descargarPlantilla(true)}>
              Exportar a Excel
            </button>
            <button type="button" className="btn btn-primario" onClick={() => setImportando(true)}>
              Importar Excel/CSV
            </button>
          </div>
        )}
        {activo === 'resumen' && resumenData && (
           <p className="texto-suave">Corte {resumenData?.fecha_corte ?? '—'} · valores registrados en «Presupuesto»</p>
        )}
      </header>

      <div className="pestanas" role="tablist" aria-label="Secciones financieras">
        <button
          type="button"
          role="tab"
          aria-selected={activo === 'resumen'}
          className={activo === 'resumen' ? 'activa' : ''}
          onClick={() => setActivo('resumen')}
        >
          Resumen Ejecución
        </button>
        {lista.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={r.id === activo}
            className={r.id === activo ? 'activa' : ''}
            onClick={() => setActivo(r.id)}
          >
            {r.titulo}
          </button>
        ))}
      </div>

      {activo === 'resumen' ? (
        !resumenData?.filas?.length ? (
          <p className="texto-suave mt-6">No hay registros de presupuesto.</p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid-indicadores">
              <StatTile etiqueta="Ingresos" valor={pesosCompactos(resumenData?.totales?.ingresos)} detalle={pesos(resumenData?.totales?.ingresos)} />
              <StatTile etiqueta="Gastos comprometidos" valor={pesosCompactos(resumenData?.totales?.gastos_comprometidos)} detalle={pesos(resumenData?.totales?.gastos_comprometidos)} />
              <StatTile etiqueta="Saldo" valor={pesosCompactos(resumenData?.totales?.saldo_comprometido)} detalle={`Ejecución ${porcentaje(resumenData?.indicadores?.pct_ejecucion)}`} />
            </div>

            <div className="grid-tarjetas">
              {(resumenData?.filas || []).map((f) => {
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
          </div>
        )
      ) : (
        recursoActual && (
          <div className="mt-6">
            <RecursoTabla
              key={`${recursoActual.id}-${version}`}
              recurso={recursoActual}
              cohortes={cohortes.data ?? []}
            />
          </div>
        )
      )}

      {importando && (
        <CsvUploaderModal
          recursos={lista}
          onClose={() => setImportando(false)}
          onImportado={() => {
            recargarResumen()
            setVersion((v) => v + 1)
          }}
        />
      )}
    </>
  )
}
