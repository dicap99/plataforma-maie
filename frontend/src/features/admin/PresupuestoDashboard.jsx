import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import RecursoTabla from './RecursoTabla.jsx'
import CsvUploaderModal from './CsvUploaderModal.jsx'
import { ordenarCohortes, suma } from './academico/estadisticas'
import { PanelEjecucion, PanelOperacion, PanelSostenibilidad } from './finanzas/PanelesFinanzas.jsx'

// Presupuesto y finanzas (RF-ADM-03): 3 pestañas por propósito. La vista «Datos» edita las hojas de cada
// pestaña y «Cargar informe de corte» actualiza el presupuesto de una promoción con el PDF de la universidad.
const PESTANAS = [
  {
    id: 'ejecucion',
    titulo: 'Ejecución presupuestal y saldos',
    icono: 'account_balance_wallet',
    filtro: 'promociones',
    hojas: [{ id: 'presupuesto', etiqueta: 'Cortes de presupuesto', icono: 'receipt_long' }],
  },
  {
    id: 'sostenibilidad',
    titulo: 'Sostenibilidad y punto de equilibrio',
    icono: 'balance',
    filtro: 'promociones',
    hojas: [
      { id: 'punto-equilibrio', etiqueta: 'Punto de equilibrio', icono: 'balance' },
      { id: 'pregrado', etiqueta: 'Aporte de estudiantes de pregrado', icono: 'school' },
    ],
  },
  {
    id: 'operacion',
    titulo: 'Gastos de personal y contrataciones',
    icono: 'payments',
    filtro: 'periodos',
    hojas: [
      { id: 'transferencias', etiqueta: 'Transferencias Vicerrectoría Académica', icono: 'swap_horiz' },
      { id: 'contrataciones', etiqueta: 'Contrataciones OPS', icono: 'contract' },
    ],
  },
]
// Los parámetros (SMMLV, reparto del saldo) alimentan las gráficas; se consultan en Gestión académica.
const HOJAS = [...PESTANAS.flatMap((p) => p.hojas.map((h) => h.id)), 'parametros']

const cargarHojas = async () => {
  const respuestas = await Promise.all(HOJAS.map((id) => adminApi.listar(id)))
  return { data: Object.fromEntries(HOJAS.map((id, i) => [id, respuestas[i].data ?? []])) }
}

function Selector({ id, etiqueta, valor, onChange, vacio, opciones }) {
  return (
    <div className="flex items-center space-x-2">
      <label className="text-xs text-slate-500 font-medium" htmlFor={id}>{etiqueta}</label>
      <select id={id} value={valor} onChange={(e) => onChange(e.target.value)}
        className="text-xs py-1.5 px-3 rounded-lg border-slate-300 bg-white text-slate-700 font-medium shadow-2xs">
        <option value="">{vacio}</option>
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
      </select>
    </div>
  )
}

export default function PresupuestoDashboard() {
  const [params] = useSearchParams()
  const [activo, setActivo] = useState(PESTANAS.some((p) => p.id === params.get('pestana')) ? params.get('pestana') : PESTANAS[0].id)
  const [hojaActiva, setHojaActiva] = useState({})
  const [vista, setVista] = useState('graficas')
  const [rango, setRango] = useState({ desde: '', hasta: '' })
  const [rangoPeriodos, setRangoPeriodos] = useState({ desde: '', hasta: '' })
  const [filtro, setFiltro] = useState(null)
  const [cargandoPdf, setCargandoPdf] = useState(false)
  const resumen = useApi(adminApi.resumenPresupuesto)
  const recursos = useApi(adminApi.listarRecursos)
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const hojas = useApi(cargarHojas)

  const apis = [resumen, recursos, cohortes, hojas]
  if (apis.some((a) => a.cargando && !a.data)) return <Cargando texto="Cargando la información financiera del programa…" />
  const conError = apis.find((a) => a.error)
  if (conError) return <ErrorApi error={conError.error} onReintentar={() => apis.forEach((a) => a.recargar())} />

  const porId = Object.fromEntries((recursos.data || []).map((r) => [r.id, r]))
  const pestana = PESTANAS.find((p) => p.id === activo)
  const hojaId = hojaActiva[pestana.id] ?? pestana.hojas[0].id
  const filas = hojas.data

  // Rango de promociones (pestañas 1 y 2).
  const todas = ordenarCohortes(cohortes.data ?? [])
  const iDesde = rango.desde ? todas.findIndex((c) => String(c.id_cohorte) === rango.desde) : 0
  const iHasta = rango.hasta ? todas.findIndex((c) => String(c.id_cohorte) === rango.hasta) : todas.length - 1
  const enRango = todas.slice(Math.max(0, iDesde), iHasta + 1)

  // Rango de semestres (pestaña 3: transferencias y contrataciones son por periodo).
  const periodos = [...new Set([...filas.transferencias, ...filas.contrataciones].map((f) => f.periodo))].sort()
  const enPeriodos = (f) => (!rangoPeriodos.desde || f.periodo >= rangoPeriodos.desde) && (!rangoPeriodos.hasta || f.periodo <= rangoPeriodos.hasta)
  const periodosEnRango = periodos.filter((p) => enPeriodos({ periodo: p }))

  const cambiarPestana = (id) => {
    setActivo(id)
    setFiltro(null)
  }
  const cambiarHoja = (id) => {
    setHojaActiva((h) => ({ ...h, [pestana.id]: id }))
    setFiltro(null)
  }
  // Un clic en una gráfica abre «Datos» en la hoja de origen, filtrada.
  const filtrar = ({ hoja, ...f }) => {
    if (hoja) setHojaActiva((h) => ({ ...h, [pestana.id]: hoja }))
    setFiltro(f)
    setVista('datos')
  }

  const recurso = porId[hojaId]
  // Tras editar o cargar un informe se recalculan las gráficas.
  const recargar = () => {
    resumen.recargar()
    hojas.recargar()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-violet-600">
            <Icono nombre="account_balance_wallet" className="text-[16px]" />
            <span>PROCESOS ADMINISTRATIVOS</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">PRESUPUESTO Y FINANZAS</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Presupuesto y finanzas</h1>
          <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
            Ejecución presupuestal y saldos, sostenibilidad de las promociones y gastos de personal del programa.
            Información confidencial de Coordinación.
          </p>
        </div>
        {porId.presupuesto?.editable && (
          <button
            type="button"
            onClick={() => setCargandoPdf(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 hover:border-violet-400 hover:text-violet-700 rounded-lg shadow-sm text-xs font-semibold transition-all group cursor-pointer"
          >
            <Icono nombre="picture_as_pdf" className="text-violet-500 group-hover:scale-110 transition-transform text-[16px]" />
            <span>Cargar informe de corte (PDF)</span>
          </button>
        )}
      </div>

      <section className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs" aria-label="Filtro">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-violet-700 font-semibold text-xs bg-violet-50/80 px-2.5 py-1.5 rounded-lg border border-violet-200/70">
            <Icono nombre="date_range" className="text-[16px]" />
            <span>{pestana.filtro === 'periodos' ? 'Rango de semestres:' : 'Rango de promociones:'}</span>
          </div>
          {pestana.filtro === 'promociones' && (
            <>
              <Selector id="desde" etiqueta="Desde" vacio="La primera" valor={rango.desde} onChange={(v) => setRango((r) => ({ ...r, desde: v }))}
                opciones={todas.slice(0, iHasta + 1).map((c) => ({ valor: String(c.id_cohorte), etiqueta: `Promoción ${c.nombre} (${c.periodo_inicio})` }))} />
              <Selector id="hasta" etiqueta="Hasta" vacio="La última" valor={rango.hasta} onChange={(v) => setRango((r) => ({ ...r, hasta: v }))}
                opciones={todas.slice(Math.max(0, iDesde)).map((c) => ({ valor: String(c.id_cohorte), etiqueta: `Promoción ${c.nombre} (${c.periodo_inicio})` }))} />
            </>
          )}
          {pestana.filtro === 'periodos' && (
            <>
              <Selector id="desde-periodo" etiqueta="Desde" vacio="El primero" valor={rangoPeriodos.desde} onChange={(v) => setRangoPeriodos((r) => ({ ...r, desde: v }))}
                opciones={periodos.filter((p) => !rangoPeriodos.hasta || p <= rangoPeriodos.hasta).map((p) => ({ valor: p, etiqueta: p }))} />
              <Selector id="hasta-periodo" etiqueta="Hasta" vacio="El último" valor={rangoPeriodos.hasta} onChange={(v) => setRangoPeriodos((r) => ({ ...r, hasta: v }))}
                opciones={periodos.filter((p) => !rangoPeriodos.desde || p >= rangoPeriodos.desde).map((p) => ({ valor: p, etiqueta: p }))} />
            </>
          )}
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {pestana.filtro === 'promociones' && `${enRango.length} de ${todas.length} promociones`}
            {pestana.filtro === 'periodos' && `${periodosEnRango.length} de ${periodos.length} semestres`}
          </span>
        </div>
      </section>

      <section className="border-b border-slate-200" role="tablist" aria-label="Secciones financieras">
        <div className="flex space-x-6 overflow-x-auto text-xs font-medium">
          {PESTANAS.map((p) => {
            const esActiva = p.id === activo
            return (
              <button key={p.id} type="button" role="tab" aria-selected={esActiva} onClick={() => cambiarPestana(p.id)}
                className={`pb-3 flex items-center space-x-2 whitespace-nowrap transition-colors cursor-pointer ${
                  esActiva ? 'text-violet-700 font-bold border-b-2 border-violet-600' : 'text-slate-500 hover:text-slate-800 border-b-2 border-transparent'
                }`}>
                <Icono nombre={p.icono} className={`text-[17px] ${esActiva ? 'text-violet-600' : 'text-slate-400'}`} />
                <span>{p.titulo}</span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs w-full">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          {vista === 'datos' && pestana.hojas.length > 1 && (
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 space-x-1 shrink-0">
              {pestana.hojas.map((h) => (
                <button key={h.id} type="button" onClick={() => cambiarHoja(h.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                    hojaId === h.id ? 'bg-white text-violet-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}>
                  <Icono nombre={h.icono} className="text-[14px]" />
                  <span>{h.etiqueta}</span>
                </button>
              ))}
            </div>
          )}
          {recurso && (
            <div className="flex items-center space-x-2 text-slate-600 font-mono shrink-0">
              <span className="inline-block w-2 h-2 rounded-full bg-violet-600"></span>
              <span className="font-semibold text-slate-700">{recurso.requisito}</span>
              <span className="text-slate-400">·</span>
              <span>{vista === 'datos' ? `Hoja «${recurso.hoja}»` : pestana.hojas.map((h) => `«${porId[h.id]?.hoja ?? h.etiqueta}»`).join(', ')}</span>
            </div>
          )}
        </div>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs ml-auto shrink-0">
          {[{ valor: 'graficas', etiqueta: 'Gráficas', icono: 'bar_chart' }, { valor: 'datos', etiqueta: 'Datos', icono: 'table_view' }].map((v) => (
            <button key={v.valor} type="button" onClick={() => setVista(v.valor)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                vista === v.valor ? 'bg-violet-600 text-white font-semibold shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}>
              <Icono nombre={v.icono} className="text-[14px]" />
              <span>{v.etiqueta}</span>
            </button>
          ))}
        </div>
      </div>

      {vista === 'graficas' ? (
        <div>
          {activo === 'ejecucion' && (
            <PanelEjecucion resumen={resumen.data} parametros={filas.parametros} cohortes={enRango} onFiltrar={filtrar} />
          )}
          {activo === 'sostenibilidad' && (
            <PanelSostenibilidad equilibrio={filas['punto-equilibrio']} pregrado={filas.pregrado} resumen={resumen.data} cohortes={enRango} onFiltrar={filtrar} />
          )}
          {activo === 'operacion' && (
            <PanelOperacion transferencias={filas.transferencias.filter(enPeriodos)} contrataciones={filas.contrataciones.filter(enPeriodos)}
              totalProyectado={suma(filas['punto-equilibrio'].map((f) => f.ingresos_proyectados))} onFiltrar={filtrar} />
          )}
        </div>
      ) : recurso ? (
        <RecursoTabla
          key={recurso.id}
          recurso={recurso}
          cohortes={cohortes.data ?? []}
          filtro={filtro}
          onQuitarFiltro={() => setFiltro(null)}
          onCambio={recargar}
          filasExternas={filas[recurso.id]}
        />
      ) : null}

      {cargandoPdf && <CsvUploaderModal soloPdf onClose={() => setCargandoPdf(false)} onImportado={recargar} />}
    </div>
  )
}
