import { useState } from 'react'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import RecursoTabla from './RecursoTabla.jsx'
import CsvUploaderModal from './CsvUploaderModal.jsx'
import { Alternador } from './academico/comunes.jsx'
import { ordenarCohortes } from './academico/estadisticas'
import PanelPromociones from './academico/PanelPromociones.jsx'
import PanelCursosDocentes from './academico/PanelCursosDocentes.jsx'
import PanelDocentes from './academico/PanelDocentes.jsx'
import PanelConteos, { BENEFICIOS, PASANTIAS, PRODUCCION } from './academico/PanelConteos.jsx'
import PanelParametros from './academico/PanelParametros.jsx'

const VISTAS = [{ valor: 'graficas', etiqueta: 'Gráficas' }, { valor: 'datos', etiqueta: 'Datos' }]
// Hojas que no dependen de la promoción (el rango de promociones no las filtra).
const SIN_PROMOCION = ['docentes', 'parametros']

// Panel de gráficas de una hoja: carga sus filas y elige la visualización según el recurso.
function PanelRecurso({ recurso, cohortes, recarga, onFiltrar }) {
  const usaCohortes = recurso.id === 'cohortes'
  const filas = useApi(() => (usaCohortes ? Promise.resolve({ data: [] }) : adminApi.listar(recurso.id)), [recurso.id, recarga])
  if (!usaCohortes && filas.cargando && !filas.data) return <Cargando texto="Preparando gráficas…" />
  if (filas.error) return <ErrorApi error={filas.error} onReintentar={filas.recargar} />
  const datos = filas.data ?? []
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
// Cada pestaña condensa la hoja en indicadores y gráficas dinámicas; la vista «Datos» conserva la tabla
// editable. Las pestañas visibles dependen del rol (el API solo devuelve los recursos que el rol puede leer).
export default function DatosProgramaPage() {
  const recursos = useApi(adminApi.listarRecursos)
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const [activo, setActivo] = useState('cohortes')
  const [vista, setVista] = useState('graficas')
  const [rango, setRango] = useState({ desde: '', hasta: '' })
  const [filtro, setFiltro] = useState(null) // { etiqueta, fn } desde un clic en una gráfica
  const [importando, setImportando] = useState(false)
  const [version, setVersion] = useState(0) // fuerza recarga de la tabla tras importar
  const [recarga, setRecarga] = useState(0) // recarga las gráficas tras editar la tabla

  if (recursos.cargando && !recursos.data) return <Cargando />
  if (recursos.error) return <ErrorApi error={recursos.error} onReintentar={recursos.recargar} />

  const lista = (recursos.data || []).filter((r) => r.categoria === 'academico')
  if (lista.length === 0) return <p className="texto-suave">Su rol no tiene acceso a los datos del programa.</p>
  const recurso = lista.find((r) => r.id === activo) ?? lista[0]
  const puedeEditar = lista.some((r) => r.editable)

  // Rango de promociones (desde–hasta) en orden cronológico.
  const todas = ordenarCohortes(cohortes.data ?? [])
  const iDesde = rango.desde ? todas.findIndex((c) => String(c.id_cohorte) === rango.desde) : 0
  const iHasta = rango.hasta ? todas.findIndex((c) => String(c.id_cohorte) === rango.hasta) : todas.length - 1
  const enRango = todas.slice(Math.max(0, iDesde), iHasta + 1)
  const aplicaRango = !SIN_PROMOCION.includes(recurso.id)

  const cambiarPestana = (id) => {
    setActivo(id)
    setFiltro(null)
  }
  const filtrar = (f) => {
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
            <Icono nombre="groups" className="text-[16px]" /> Procesos administrativos
          </div>
          <h1 className="m-0 mt-1 font-display text-headline-lg text-primary">Información académica</h1>
          <p className="m-0 max-w-3xl text-body-md text-on-surface-variant">
            Promociones, cursos y docentes, beneficios, producción científica y pasantías del programa. Cada hoja se resume en
            indicadores y gráficas; en «Datos» está el registro completo.
          </p>
        </div>
        {puedeEditar && (
          <div className="flex flex-wrap gap-space-sm">
            <button type="button" className="btn btn-secundario" onClick={() => adminApi.descargarPlantilla(true)}>
              <Icono nombre="file_download" className="text-[18px]" /> Exportar a Excel
            </button>
            <button type="button" className="btn btn-primario" onClick={() => setImportando(true)}>
              <Icono nombre="upload_file" className="text-[18px]" /> Importar Excel/CSV
            </button>
          </div>
        )}
      </header>

      <section className="flex flex-wrap items-center gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm" aria-label="Rango de promociones">
        <span className="inline-flex items-center gap-1 text-label-md font-semibold text-primary">
          <Icono nombre="date_range" className="text-[18px] text-secondary" /> Rango de promociones
        </span>
        {selectorPromocion('desde', 'Desde', todas.slice(0, iHasta + 1))}
        {selectorPromocion('hasta', 'Hasta', todas.slice(Math.max(0, iDesde)))}
        <span className="text-body-sm text-on-surface-variant">
          {aplicaRango ? `${enRango.length} de ${todas.length} promociones` : 'Esta hoja no se filtra por promoción'}
        </span>
      </section>

      <div className="pestanas" role="tablist" aria-label="Hojas de datos">
        {lista.map((r) => (
          <button key={r.id} type="button" role="tab" aria-selected={r.id === recurso.id} className={r.id === recurso.id ? 'activa' : ''}
            onClick={() => cambiarPestana(r.id)}>
            {r.titulo}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <p className="m-0 text-body-sm text-on-surface-variant">{recurso.requisito} · Hoja «{recurso.hoja}»</p>
        <Alternador etiqueta="Vista" opciones={VISTAS} valor={vista} onChange={setVista} />
      </div>

      {vista === 'graficas' ? (
        <PanelRecurso
          key={recurso.id}
          recurso={recurso}
          cohortes={recurso.id === 'cohortes' ? enRango : aplicaRango ? enRango : todas}
          recarga={`${recarga}-${version}`}
          onFiltrar={filtrar}
        />
      ) : (
        <RecursoTabla
          key={`${recurso.id}-${version}`}
          recurso={recurso}
          cohortes={cohortes.data ?? []}
          filtro={filtro}
          onQuitarFiltro={() => setFiltro(null)}
          onCambio={() => {
            if (recurso.id === 'cohortes') cohortes.recargar()
            setRecarga((n) => n + 1)
          }}
        />
      )}

      {importando && (
        <CsvUploaderModal
          recursos={lista}
          onClose={() => setImportando(false)}
          onImportado={() => {
            cohortes.recargar()
            setVersion((v) => v + 1)
          }}
        />
      )}
    </div>
  )
}
