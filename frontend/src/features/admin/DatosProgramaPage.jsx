import { useState } from 'react'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import RecursoTabla from './RecursoTabla.jsx'
import CsvUploaderModal from './CsvUploaderModal.jsx'
import { ordenarCohortes } from './academico/estadisticas'
import PanelPromociones from './academico/PanelPromociones.jsx'
import PanelCuerpoAcademico from './academico/PanelCuerpoAcademico.jsx'
import PanelConteos, { BENEFICIOS } from './academico/PanelConteos.jsx'
import PanelInvestigacionMovilidad from './academico/PanelInvestigacionMovilidad.jsx'

// Definición de las 4 Dimensiones Académicas Estratégicas para Información Académica
const PESTANAS = [
  {
    id: 'cohortes',
    titulo: 'Trayectoria y Eficiencia',
    icono: 'groups',
    subtitulo: 'Permanencia, retención, aprobación y graduación por cohorte',
    recursos: ['cohortes'],
  },
  {
    id: 'cuerpo-academico',
    titulo: 'Cuerpo Académico y Oferta',
    icono: 'badge',
    subtitulo: 'Planta docente, filiación Udenar/externa, campos de formación y oferta semestral',
    recursos: ['docentes', 'cohorte-semestres'],
    subrecursos: [
      { id: 'docentes', etiqueta: 'Directorio y Perfiles Docentes', icono: 'badge' },
      { id: 'cohorte-semestres', etiqueta: 'Cursos y Carga por Semestre', icono: 'calendar_month' },
    ],
  },
  {
    id: 'beneficios',
    titulo: 'Apoyos y Beneficios',
    icono: 'loyalty',
    subtitulo: 'Cobertura de becas institucionales, monitorías y asistencias',
    recursos: ['beneficios'],
  },
  {
    id: 'investigacion',
    titulo: 'Investigación y Movilidad',
    icono: 'science',
    subtitulo: 'Producción científica (artículos, software, tesis) y pasantías de investigación',
    recursos: ['productos', 'produccion', 'pasantias'],
    subrecursos: [
      { id: 'productos', etiqueta: 'Productos', icono: 'article' },
      { id: 'produccion', etiqueta: 'Producción Científica', icono: 'auto_stories' },
      { id: 'pasantias', etiqueta: 'Pasantías de Investigación', icono: 'flight_takeoff' },
    ],
  },
]

export default function DatosProgramaPage() {
  const recursos = useApi(adminApi.listarRecursos)
  const reflejo = useApi(adminApi.reflejoAcademico)
  const docentesApi = useApi(() => adminApi.listar('docentes'))
  // La «Producción científica» viene del reflejo: se calcula con los productos registrados.
  const productosApi = useApi(() => adminApi.listar('productos'))
  const pasantiasApi = useApi(() => adminApi.listar('pasantias'))
  // Solo Coordinación lee los parámetros; si no hay acceso, la gráfica de créditos no se muestra.
  const parametrosApi = useApi(() => adminApi.listar('parametros'))

  const [activo, setActivo] = useState('cohortes')
  const [subActivo, setSubActivo] = useState({
    'cuerpo-academico': 'docentes',
    investigacion: 'productos',
  })
  const [vista, setVista] = useState('datos')
  const [rango, setRango] = useState({ desde: '', hasta: '' })
  const [filtro, setFiltro] = useState(null)
  const [importando, setImportando] = useState(false)

  const cargando =
    (recursos.cargando && !recursos.data) ||
    (reflejo.cargando && !reflejo.data) ||
    (docentesApi.cargando && !docentesApi.data) ||
    (productosApi.cargando && !productosApi.data) ||
    (pasantiasApi.cargando && !pasantiasApi.data)

  if (cargando) return <Cargando texto="Cargando información académica del programa…" />

  const error =
    recursos.error ||
    reflejo.error ||
    docentesApi.error ||
    productosApi.error ||
    pasantiasApi.error

  // Tras editar o importar se recargan las hojas: las gráficas se actualizan al momento.
  const recargarTodo = () => {
    recursos.recargar()
    reflejo.recargar()
    docentesApi.recargar()
    productosApi.recargar()
    pasantiasApi.recargar()
  }

  if (error) return <ErrorApi error={error} onReintentar={recargarTodo} />

  const listaRecursos = recursos.data || []
  const puedeEditar = listaRecursos.some((r) => r.editable)

  // Metadatos de cada recurso
  const porId = Object.fromEntries(listaRecursos.map((r) => [r.id, r]))
  const pestanaActual = PESTANAS.find((p) => p.id === activo) ?? PESTANAS[0]

  // Recurso activo para la vista tabular (Datos)
  const recursoActivoId =
    pestanaActual.subrecursos?.length > 0
      ? subActivo[pestanaActual.id] ?? pestanaActual.subrecursos[0].id
      : pestanaActual.recursos[0]

  const recursoActivo = porId[recursoActivoId] ?? listaRecursos[0]

  // Rango de promociones
  const cohortesReflejadas = reflejo.data?.cohortes ?? []
  const todas = ordenarCohortes(cohortesReflejadas)
  const iDesde = rango.desde ? todas.findIndex((c) => String(c.id_cohorte) === rango.desde) : 0
  const iHasta = rango.hasta ? todas.findIndex((c) => String(c.id_cohorte) === rango.hasta) : todas.length - 1
  const enRango = todas.slice(Math.max(0, iDesde), iHasta + 1)
  const aplicaRango = activo !== 'cuerpo-academico' || recursoActivoId === 'cohorte-semestres'

  const cambiarPestana = (id) => {
    setActivo(id)
    setFiltro(null)
  }

  const cambiarSubrecurso = (subId) => {
    setSubActivo((prev) => ({ ...prev, [activo]: subId }))
    setFiltro(null)
  }

  const filtrar = (f) => {
    setFiltro(f)
    setVista('datos')
  }

  // Conteo de registros para la barra secundaria
  const conteoFilas = (() => {
    switch (recursoActivoId) {
      case 'cohortes':
        return enRango.length
      case 'cohorte-semestres':
        return (reflejo.data?.['cohorte-semestres'] ?? []).length
      case 'docentes':
        return (docentesApi.data ?? []).length
      case 'beneficios':
        return (reflejo.data?.beneficios ?? []).length
      case 'productos':
        return (productosApi.data ?? []).length
      case 'produccion':
        return (reflejo.data?.produccion ?? []).length
      case 'pasantias':
        return (pasantiasApi.data ?? []).length
      default:
        return 0
    }
  })()

  // Determinar si el recurso activo en la tabla proviene de un reflejo
  const filasExternas = (() => {
    if (recursoActivoId === 'cohortes') return enRango
    if (recursoActivoId === 'cohorte-semestres') return reflejo.data?.['cohorte-semestres']
    if (recursoActivoId === 'beneficios') return reflejo.data?.beneficios
    if (recursoActivoId === 'docentes') return docentesApi.data
    if (recursoActivoId === 'productos') return productosApi.data
    if (recursoActivoId === 'produccion') return reflejo.data?.produccion
    if (recursoActivoId === 'pasantias') return pasantiasApi.data
    return undefined
  })()

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado y Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-violet-600">
            <Icono nombre="folder_special" className="text-[16px]" />
            <span>PROCESOS ADMINISTRATIVOS</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">INFORMACIÓN ACADÉMICA</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Información académica</h1>
          <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
            Consolidado estratégico de cohortes, cuerpo docente, beneficios e investigación del programa.
            Diseñado para procesos de autoevaluación continua, comités curriculares y acreditación institucional.
          </p>
        </div>
        {puedeEditar && (
          <button
            type="button"
            onClick={() => setImportando(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 hover:border-violet-400 hover:text-violet-700 rounded-lg shadow-sm text-xs font-semibold transition-all group cursor-pointer"
          >
            <Icono nombre="upload_file" className="text-violet-500 group-hover:scale-110 transition-transform text-[16px]" />
            <span>Importar Excel</span>
          </button>
        )}
      </div>

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
              {aplicaRango ? `${enRango.length} de ${todas.length} promociones` : 'Mostrando consolidado general del programa'}
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

      {/* Pestañas de Navegación por las 4 Dimensiones Estratégicas */}
      <section className="border-b border-slate-200" role="tablist" aria-label="Dimensiones de información académica">
        <div className="flex space-x-6 overflow-x-auto text-xs font-medium">
          {PESTANAS.map((p) => {
            const esActiva = p.id === activo
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={esActiva}
                onClick={() => cambiarPestana(p.id)}
                className={`pb-3 flex items-center space-x-2 whitespace-nowrap transition-colors cursor-pointer ${
                  esActiva
                    ? 'text-violet-700 font-bold border-b-2 border-violet-600'
                    : 'text-slate-500 hover:text-slate-800 border-b-2 border-transparent'
                }`}
              >
                <Icono nombre={p.icono} className={`text-[17px] ${esActiva ? 'text-violet-600' : 'text-slate-400'}`} />
                <span>{p.titulo}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Barra de Controles Secundarios: Selector de Subrecurso (en vista Datos) + Metadatos + Alternador Gráficas/Datos */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs w-full">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          {/* Sub-selector de hojas cuando la dimensión tiene múltiples recursos en vista Datos */}
          {vista === 'datos' && pestanaActual.subrecursos?.length > 0 && (
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 space-x-1 shrink-0">
              {pestanaActual.subrecursos.map((sub) => {
                const esSubActivo = recursoActivoId === sub.id
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => cambiarSubrecurso(sub.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                      esSubActivo
                        ? 'bg-white text-violet-700 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icono nombre={sub.icono} className="text-[14px]" />
                    <span>{sub.etiqueta}</span>
                  </button>
                )
              })}
            </div>
          )}

          {recursoActivo && (
            <div className="flex items-center space-x-2 text-slate-600 font-mono shrink-0">
              <span className="inline-block w-2 h-2 rounded-full bg-violet-600"></span>
              <span className="font-semibold text-slate-700">{recursoActivo.requisito}</span>
              <span className="text-slate-400">·</span>
              <span>Hoja «{recursoActivo.hoja}»</span>
              <span className="text-slate-400">·</span>
              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-sans font-bold">
                {conteoFilas} registro(s)
              </span>
            </div>
          )}
        </div>

        {/* Alternador Gráficas / Datos SIEMPRE anclado a la derecha */}
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs ml-auto shrink-0">
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

      {/* Contenido: Gráficas o Tablas de Datos */}
      {vista === 'graficas' ? (
        <div>
          {activo === 'cohortes' && (
            <PanelPromociones cohortes={enRango} onFiltrar={filtrar} />
          )}

          {activo === 'cuerpo-academico' && (
            <PanelCuerpoAcademico
              filasDocentes={docentesApi.data ?? []}
              filasCursos={reflejo.data?.['cohorte-semestres'] ?? []}
              cohortes={enRango}
              parametros={parametrosApi.data ?? []}
              onFiltrar={(f) => {
                cambiarSubrecurso(f.esSemestre ? 'cohorte-semestres' : 'docentes')
                filtrar(f)
              }}
            />
          )}

          {activo === 'beneficios' && (
            <PanelConteos
              filas={reflejo.data?.beneficios ?? []}
              cohortes={enRango}
              config={BENEFICIOS}
              onFiltrar={filtrar}
            />
          )}

          {activo === 'investigacion' && (
            <PanelInvestigacionMovilidad
              filasProduccion={reflejo.data?.produccion ?? []}
              filasPasantias={pasantiasApi.data ?? []}
              cohortes={enRango}
              onFiltrar={(f) => {
                cambiarSubrecurso(f.esPasantia ? 'pasantias' : 'produccion')
                filtrar(f)
              }}
            />
          )}
        </div>
      ) : (
        <RecursoTabla
          key={`${recursoActivo.id}-${recursoActivoId}`}
          recurso={recursoActivo}
          cohortes={cohortesReflejadas}
          filtro={filtro}
          onQuitarFiltro={() => setFiltro(null)}
          onCambio={recargarTodo}
          filasExternas={filasExternas}
        />
      )}

      {importando && (
        <CsvUploaderModal
          recursos={listaRecursos.filter((r) => r.id !== 'parametros')}
          onClose={() => setImportando(false)}
          onImportado={recargarTodo}
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
