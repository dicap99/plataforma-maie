import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import RecursoTabla from './RecursoTabla.jsx'
import { ordenarCohortes, indicadoresPromociones, suma } from './academico/estadisticas'
import { numero, porcentaje } from '../../utils/formato'
import PanelPromociones from './academico/PanelPromociones.jsx'
import PanelCursosDocentes from './academico/PanelCursosDocentes.jsx'
import PanelDocentes from './academico/PanelDocentes.jsx'
import PanelConteos, { BENEFICIOS, PASANTIAS, PRODUCCION } from './academico/PanelConteos.jsx'
import PanelParametros from './academico/PanelParametros.jsx'

// Hojas que no dependen de la promoción (el rango de promociones no las filtra).
const SIN_PROMOCION = ['docentes', 'parametros']

// Hojas que reflejan Gestión académica (sus filas vienen de /admin/academico/reflejo).
const REFLEJADAS = ['cohortes', 'beneficios', 'cohorte-semestres']

const ICONOS_TAB = {
  cohortes: 'groups',
  'cohorte-semestres': 'calendar_month',
  docentes: 'badge',
  beneficios: 'loyalty',
  produccion: 'science',
  pasantias: 'flight_takeoff',
  parametros: 'tune',
}

// Panel de gráficas de una hoja: usa el reflejo o carga sus filas, y elige la visualización.
function PanelRecurso({ recurso, cohortes, reflejo, onFiltrar }) {
  const reflejada = REFLEJADAS.includes(recurso.id)
  const filas = useApi(() => (reflejada ? Promise.resolve({ data: null }) : adminApi.listar(recurso.id)), [recurso.id])
  if (!reflejada && filas.cargando && !filas.data) return <Cargando texto="Preparando gráficas…" />
  if (filas.error) return <ErrorApi error={filas.error} onReintentar={filas.recargar} />
  const datos = reflejada ? reflejo[recurso.id] ?? [] : filas.data ?? []
  const comunes = { cohortes, onFiltrar }
  switch (recurso.id) {
    case 'cohortes': return <PanelPromociones {...comunes} />
    case 'cohorte-semestres': return <PanelCursosDocentes filas={datos} {...comunes} />
    case 'docentes': return <PanelDocentes filas={datos} onFiltrar={onFiltrar} />
    case 'beneficios': return <PanelConteos filas={datos} {...comunes} config={BENEFICIOS} />
    case 'produccion': return <PanelConteos filas={datos} {...comunes} config={PRODUCCION} />
    case 'pasantias': return <PanelConteos filas={datos} {...comunes} config={PASANTIAS} />
    case 'parametros': return <PanelParametros filas={datos} />
    default: return <p className="texto-suave">Esta hoja no tiene gráficas; consulte la vista «Datos».</p>
  }
}

// "Información académica": una pestaña por hoja académica de «Estadísticas MaIE» (RF-ADM-01 a RF-ADM-06).
// Es un reflejo de Gestión académica y no se edita aquí: promociones, beneficios y cursos y docentes por
// semestre combinan lo registrado en Gestión con el histórico de la hoja. Cada pestaña muestra indicadores y
// gráficas, y la vista «Datos» la tabla en solo lectura. Las pestañas visibles dependen del rol.
export default function DatosProgramaPage() {
  const recursos = useApi(adminApi.listarRecursos)
  const reflejo = useApi(adminApi.reflejoAcademico)
  const cohortes = { data: reflejo.data?.cohortes }
  const [activo, setActivo] = useState('cohortes')
  const [vista, setVista] = useState('datos')
  const [rango, setRango] = useState({ desde: '', hasta: '' })
  const [filtro, setFiltro] = useState(null) // { etiqueta, fn } desde un clic en una gráfica

  if ((recursos.cargando && !recursos.data) || (reflejo.cargando && !reflejo.data)) return <Cargando />
  if (recursos.error) return <ErrorApi error={recursos.error} onReintentar={recursos.recargar} />
  if (reflejo.error) return <ErrorApi error={reflejo.error} onReintentar={reflejo.recargar} />

  const lista = (recursos.data || []).filter((r) => r.categoria === 'academico')
  if (lista.length === 0) return <p className="texto-suave">Su rol no tiene acceso a los datos del programa.</p>
  const recurso = lista.find((r) => r.id === activo) ?? lista[0]
  const puedeEditar = lista.some((r) => r.editable)
  const reflejada = REFLEJADAS.includes(recurso.id)

  // Rango de promociones (desde–hasta) en orden cronológico.
  const todas = ordenarCohortes(cohortes.data ?? [])
  const iDesde = rango.desde ? todas.findIndex((c) => String(c.id_cohorte) === rango.desde) : 0
  const iHasta = rango.hasta ? todas.findIndex((c) => String(c.id_cohorte) === rango.hasta) : todas.length - 1
  const enRango = todas.slice(Math.max(0, iDesde), iHasta + 1)
  const aplicaRango = !SIN_PROMOCION.includes(recurso.id)

  // Métricas superiores (indicadores globales del programa)
  const indGlobal = indicadoresPromociones(enRango)
  const egresadas = enRango.filter((c) => typeof c.egresados === 'number')
  const totalEgresados = suma(egresadas.map((c) => c.egresados))
  const totalGraduados = suma(egresadas.map((c) => c.graduados))
  const cohortesActivas = enRango.filter((c) => typeof c.egresados !== 'number')
  const nombresActivas = cohortesActivas.map((c) => c.nombre).join(' y ')

  const cambiarPestana = (id) => {
    setActivo(id)
    setFiltro(null)
  }
  const filtrar = (f) => {
    setFiltro(f)
    setVista('datos')
  }

  // Conteo de registros para la barra secundaria
  const filasHoja = reflejada ? (reflejo.data?.[recurso.id] ?? []) : (recurso.id === 'cohortes' ? enRango : [])
  const conteoFilas = recurso.id === 'cohortes' ? enRango.length : (filasHoja.length || enRango.length)

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado y Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-violet-600">
            <Icono nombre="folder_special" className="text-[16px]" />
            <span>PROCESOS ADMINISTRATIVOS</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">COHORTES Y EFICIENCIA</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Información académica</h1>
          <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
            Promociones, cursos y docentes, beneficios, producción científica y pasantías del programa, tal como se
            registran en Gestión académica. Cada hoja se resume en indicadores y gráficas; en «Datos» está el detalle
            tabular para comités curriculares y acreditación.
          </p>
        </div>
        {puedeEditar && (
          <div className="flex items-center space-x-3">
            <Link
              to="/coordinacion/gestion?pestana=datos"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 hover:border-violet-400 hover:text-violet-700 rounded-lg shadow-sm text-xs font-semibold transition-all group no-underline"
            >
              <Icono nombre="edit_square" className="text-violet-500 group-hover:scale-110 transition-transform text-[16px]" />
              <span>Editar en Gestión académica</span>
            </Link>
          </div>
        )}
      </div>

      {/* Resumen de Métricas Clave (4 KPI Cards) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Resumen de métricas">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
            <Icono nombre="groups" className="text-[20px]" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Matriculados</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-bold text-slate-800 tabular-numbers">{numero(indGlobal.matriculados)}</span>
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center">
                <Icono nombre="north" className="text-[10px] mr-0.5" /> {enRango.length} promociones
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold shrink-0">
            <Icono nombre="school" className="text-[20px]" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Graduados</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-bold text-slate-800 tabular-numbers">{numero(totalGraduados)}</span>
              <span className="text-[10px] text-slate-500 font-medium">de {totalEgresados} culminados</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 font-bold shrink-0">
            <Icono nombre="pie_chart" className="text-[20px]" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Eficiencia Terminal</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-bold text-slate-800 tabular-numbers">{porcentaje(indGlobal.tasaGraduacion)}</span>
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1 rounded border border-emerald-200/50">
                {indGlobal.tasaGraduacion >= 0.75 ? 'Sobresaliente' : indGlobal.tasaGraduacion >= 0.5 ? 'Aceptable' : 'En seguimiento'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-bold shrink-0">
            <Icono nombre="schedule" className="text-[20px]" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Cohortes Activas</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-bold text-slate-800 tabular-numbers">{numero(indGlobal.enCurso)}</span>
              <span className="text-[10px] text-amber-700 font-medium truncate max-w-[140px]" title={nombresActivas}>
                {nombresActivas ? `Sintética ${nombresActivas}` : 'En curso'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Barra de Filtro de Rango y Acciones */}
      <section className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs" aria-label="Filtro de promociones">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 text-violet-700 font-semibold text-xs bg-violet-50/80 px-2.5 py-1.5 rounded-lg border border-violet-200/70">
              <Icono nombre="date_range" className="text-[16px]" />
              <span>Rango de promociones:</span>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs text-slate-500 font-medium" htmlFor="select-desde">Desde</label>
              <select
                id="select-desde"
                value={rango.desde}
                onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))}
                className="text-xs py-1.5 px-3 rounded-lg border-slate-300 bg-white text-slate-700 font-medium shadow-2xs"
              >
                <option value="">La primera</option>
                {todas.slice(0, iHasta + 1).map((c) => (
                  <option key={c.id_cohorte} value={c.id_cohorte}>
                    Promoción {c.nombre} ({c.periodo_inicio})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs text-slate-500 font-medium" htmlFor="select-hasta">Hasta</label>
              <select
                id="select-hasta"
                value={rango.hasta}
                onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))}
                className="text-xs py-1.5 px-3 rounded-lg border-slate-300 bg-white text-slate-700 font-medium shadow-2xs"
              >
                <option value="">La última</option>
                {todas.slice(Math.max(0, iDesde)).map((c) => (
                  <option key={c.id_cohorte} value={c.id_cohorte}>
                    Promoción {c.nombre} ({c.periodo_inicio})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {aplicaRango ? `${enRango.length} de ${todas.length} promociones` : 'Esta hoja no se filtra por promoción'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => adminApi.descargarPlantilla(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <Icono nombre="table_view" className="text-emerald-600 text-[16px]" />
              <span>Exportar Excel</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <Icono nombre="print" className="text-slate-500 text-[16px]" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </section>

      {/* Pestañas de Navegación por Hojas */}
      <section className="border-b border-slate-200" role="tablist" aria-label="Hojas de datos">
        <div className="flex space-x-6 overflow-x-auto text-xs font-medium">
          {lista.map((r) => {
            const esActiva = r.id === recurso.id
            const icono = ICONOS_TAB[r.id]
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={esActiva}
                onClick={() => cambiarPestana(r.id)}
                className={`pb-3 flex items-center space-x-2 whitespace-nowrap transition-colors cursor-pointer ${
                  esActiva
                    ? 'text-violet-700 font-bold border-b-2 border-violet-600'
                    : 'text-slate-500 hover:text-slate-800 border-b-2 border-transparent'
                }`}
              >
                {icono && <Icono nombre={icono} className={`text-[16px] ${esActiva ? 'text-violet-600' : 'text-slate-400'}`} />}
                <span>{r.titulo}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Barra de Controles Secundarios (Requisito + Alternador de Vista) */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-2 text-slate-600 font-mono">
          <span className="inline-block w-2 h-2 rounded-full bg-violet-600"></span>
          <span className="font-semibold text-slate-700">{recurso.requisito}</span>
          <span className="text-slate-400">·</span>
          <span>Hoja «{recurso.hoja}»</span>
          <span className="text-slate-400">·</span>
          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-sans font-bold">
            {conteoFilas} registro(s)
          </span>
        </div>

        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setVista('graficas')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
              vista === 'graficas'
                ? 'bg-violet-600 text-white font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icono nombre="bar_chart" className="text-[14px]" />
            <span>Gráficas</span>
          </button>
          <button
            type="button"
            onClick={() => setVista('datos')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
              vista === 'datos'
                ? 'bg-violet-600 text-white font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icono nombre="table_view" className="text-[14px]" />
            <span>Datos</span>
          </button>
        </div>
      </div>

      {/* Contenido: Gráficas o Tabla de Datos */}
      {vista === 'graficas' ? (
        <PanelRecurso
          key={recurso.id}
          recurso={recurso}
          cohortes={aplicaRango ? enRango : todas}
          reflejo={reflejo.data}
          onFiltrar={filtrar}
        />
      ) : (
        <RecursoTabla
          key={recurso.id}
          recurso={recurso}
          cohortes={cohortes.data ?? []}
          filtro={filtro}
          onQuitarFiltro={() => setFiltro(null)}
          soloLectura
          filasExternas={reflejada ? (recurso.id === 'cohortes' ? enRango : reflejo.data[recurso.id]) : undefined}
        />
      )}

      {/* Pie institucional de acreditación */}
      <footer className="pt-4 pb-6 flex flex-wrap items-center justify-between text-xs text-slate-400 border-t border-slate-200/60 gap-4 mt-4">
        <div className="flex items-center space-x-2">
          <Icono nombre="info" className="text-indigo-400 text-[16px]" />
          <span>Datos consolidados para fines de autoevaluación y acreditación de alta calidad - Universidad de Nariño.</span>
        </div>
        <div className="font-mono text-[11px]">
          Sede Torobajo · Pasto, Nariño, Colombia
        </div>
      </footer>
    </div>
  )
}

