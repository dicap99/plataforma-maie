import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import RecursoTabla from './RecursoTabla.jsx'
import { Alternador } from './academico/comunes.jsx'
import { ordenarCohortes } from './academico/estadisticas'
import {
  CONTRATACIONES, PanelPorPeriodo, PanelPregrado, PanelPresupuesto, PanelPuntoEquilibrio, PanelResumen, TRANSFERENCIAS,
} from './finanzas/PanelesFinanzas.jsx'
import PanelParametros from './academico/PanelParametros.jsx'

const VISTAS = [{ valor: 'graficas', etiqueta: 'Gráficas' }, { valor: 'datos', etiqueta: 'Datos' }]
const RESUMEN = 'resumen'
// Hojas por periodo o sin promoción (no se filtran por promoción).
const POR_PERIODO = ['transferencias', 'contrataciones', 'parametros']

function PanelRecurso({ recurso, cohortes, recarga, onFiltrar }) {
  const filas = useApi(() => adminApi.listar(recurso.id), [recurso.id, recarga])
  if (filas.cargando && !filas.data) return <Cargando texto="Preparando gráficas…" />
  if (filas.error) return <ErrorApi error={filas.error} onReintentar={filas.recargar} />
  const props = { filas: filas.data ?? [], cohortes, onFiltrar }
  switch (recurso.id) {
    case 'punto-equilibrio': return <PanelPuntoEquilibrio {...props} />
    case 'presupuesto': return <PanelPresupuesto {...props} />
    case 'pregrado': return <PanelPregrado {...props} />
    case 'transferencias': return <PanelPorPeriodo {...props} config={TRANSFERENCIAS} />
    case 'contrataciones': return <PanelPorPeriodo {...props} config={CONTRATACIONES} />
    case 'parametros': return <PanelParametros filas={props.filas} />
    default: return <p className="texto-suave">Esta hoja no tiene gráficas; consulte la vista «Datos».</p>
  }
}

// Presupuesto y finanzas (RF-ADM-03): resumen de ejecución y una pestaña por hoja financiera con
// indicadores y gráficas dinámicas; la vista «Datos» muestra la tabla en solo lectura (se edita en
// Gestión académica › Datos del programa).
export default function PresupuestoDashboard() {
  const [activo, setActivo] = useState(RESUMEN)
  const [vista, setVista] = useState('graficas')
  const [rango, setRango] = useState({ desde: '', hasta: '' })
  const [filtro, setFiltro] = useState(null)
  const resumen = useApi(adminApi.resumenPresupuesto)
  const recursos = useApi(adminApi.listarRecursos)
  const cohortes = useApi(() => adminApi.listar('cohortes'))

  if ((resumen.cargando && !resumen.data) || (recursos.cargando && !recursos.data)) return <Cargando />
  if (resumen.error) return <ErrorApi error={resumen.error} onReintentar={resumen.recargar} />
  if (recursos.error) return <ErrorApi error={recursos.error} onReintentar={recursos.recargar} />

  const lista = (recursos.data || []).filter((r) => r.categoria === 'financiero')
  const recurso = lista.find((r) => r.id === activo)
  const enResumen = activo === RESUMEN || !recurso
  const puedeEditar = lista.some((r) => r.editable)

  const todas = ordenarCohortes(cohortes.data ?? [])
  const iDesde = rango.desde ? todas.findIndex((c) => String(c.id_cohorte) === rango.desde) : 0
  const iHasta = rango.hasta ? todas.findIndex((c) => String(c.id_cohorte) === rango.hasta) : todas.length - 1
  const enRango = todas.slice(Math.max(0, iDesde), iHasta + 1)
  const aplicaRango = enResumen || !POR_PERIODO.includes(recurso.id)

  const cambiarPestana = (id) => {
    setActivo(id)
    setFiltro(null)
  }
  // Un clic en una gráfica abre «Datos» filtrado; el resumen lleva a la hoja de presupuesto.
  const filtrar = ({ recurso: destino, ...f }) => {
    if (destino) setActivo(destino)
    setFiltro(f)
    setVista('datos')
  }
  const selectorPromocion = (campo, etiqueta, opciones) => (
    <label className="flex items-center gap-2 text-label-md text-on-surface-variant">
      {etiqueta}
      <select value={rango[campo]} onChange={(e) => setRango((r) => ({ ...r, [campo]: e.target.value }))}
        className="rounded-lg px-2 py-1.5 text-body-md text-on-surface">
        <option value="">{campo === 'desde' ? 'La primera' : 'La última'}</option>
        {opciones.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>Promoción {c.nombre} ({c.periodo_inicio})</option>)}
      </select>
    </label>
  )

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-sm md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
            <Icono nombre="account_balance_wallet" className="text-[16px]" /> Procesos administrativos
          </div>
          <h1 className="m-0 mt-1 font-display text-headline-lg text-primary">Presupuesto y finanzas</h1>
          <p className="m-0 max-w-3xl text-body-md text-on-surface-variant">
            Ejecución presupuestal, punto de equilibrio, aporte del pregrado, transferencias y contrataciones del programa.
          </p>
        </div>
        {puedeEditar && (
          <Link to="/coordinacion/gestion?pestana=datos" className="btn btn-secundario no-underline">
            <Icono nombre="edit" className="text-[18px]" /> Editar en Gestión académica
          </Link>
        )}
      </header>

      <section className="flex flex-wrap items-center gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm" aria-label="Rango de promociones">
        <span className="inline-flex items-center gap-1 text-label-md font-semibold text-primary">
          <Icono nombre="date_range" className="text-[18px] text-secondary" /> Rango de promociones
        </span>
        {selectorPromocion('desde', 'Desde', todas.slice(0, iHasta + 1))}
        {selectorPromocion('hasta', 'Hasta', todas.slice(Math.max(0, iDesde)))}
        <span className="text-body-sm text-on-surface-variant">
          {aplicaRango ? `${enRango.length} de ${todas.length} promociones` : 'Esta hoja es por periodo y no se filtra por promoción'}
        </span>
      </section>

      <div className="pestanas" role="tablist" aria-label="Secciones financieras">
        <button type="button" role="tab" aria-selected={enResumen} className={enResumen ? 'activa' : ''} onClick={() => cambiarPestana(RESUMEN)}>
          Resumen de ejecución
        </button>
        {lista.map((r) => (
          <button key={r.id} type="button" role="tab" aria-selected={r.id === activo} className={r.id === activo ? 'activa' : ''}
            onClick={() => cambiarPestana(r.id)}>
            {r.titulo}
          </button>
        ))}
      </div>

      {enResumen ? (
        <PanelResumen resumen={resumen.data} cohortes={enRango} onFiltrar={filtrar} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-space-sm w-full">
            <p className="m-0 text-body-sm text-on-surface-variant">{recurso.requisito} · Hoja «{recurso.hoja}»</p>
            <div className="ml-auto shrink-0">
              <Alternador etiqueta="Vista" opciones={VISTAS} valor={vista} onChange={setVista} />
            </div>
          </div>
          {vista === 'graficas' ? (
            <PanelRecurso key={recurso.id} recurso={recurso} cohortes={enRango} recarga={0} onFiltrar={filtrar} />
          ) : (
            <RecursoTabla
              key={recurso.id}
              recurso={recurso}
              cohortes={cohortes.data ?? []}
              filtro={filtro}
              onQuitarFiltro={() => setFiltro(null)}
              soloLectura
            />
          )}
        </>
      )}

    </div>
  )
}
