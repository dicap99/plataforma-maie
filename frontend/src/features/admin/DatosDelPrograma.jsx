import { useState } from 'react'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import RecursoTabla from './RecursoTabla.jsx'
import CsvUploaderModal from './CsvUploaderModal.jsx'

const GRUPOS = [
  { categoria: 'academico', titulo: 'Académicas' },
  { categoria: 'financiero', titulo: 'Financieras' },
]

// Datos del programa (RF-ADM-01 a RF-ADM-06), pestaña de Gestión académica: único lugar donde se
// editan las hojas del libro «Estadísticas MaIE» y se importa o exporta el Excel. Información
// académica y Presupuesto y finanzas solo las muestran.
export default function DatosDelPrograma() {
  const recursos = useApi(adminApi.listarRecursos)
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const [activo, setActivo] = useState('cohortes')
  const [importando, setImportando] = useState(false)
  const [version, setVersion] = useState(0)

  if (recursos.cargando && !recursos.data) return <Cargando />
  if (recursos.error) return <ErrorApi error={recursos.error} onReintentar={recursos.recargar} />
  const lista = recursos.data ?? []
  const recurso = lista.find((r) => r.id === activo) ?? lista[0]
  if (!recurso) return <p className="texto-suave">No hay hojas disponibles para su rol.</p>

  return (
    <section className="flex flex-col gap-space-md">
      <div className="flex flex-col justify-between gap-space-sm md:flex-row md:items-start">
        <p className="m-0 max-w-3xl text-body-sm text-on-surface-variant">
          Registro de las hojas del libro «Estadísticas MaIE». Lo que se registra en Usuarios y en la asignación por
          semestre (estudiantes, becas, docentes y clases) se refleja automáticamente en Información académica; estas
          hojas guardan el resto y el histórico de las promociones anteriores.
        </p>
        <div className="flex shrink-0 flex-wrap gap-space-sm">
          <button type="button" className="btn btn-secundario" onClick={() => adminApi.descargarPlantilla(true)}>
            <Icono nombre="file_download" className="text-[18px]" /> Exportar a Excel
          </button>
          <button type="button" className="btn btn-primario" onClick={() => setImportando(true)}>
            <Icono nombre="upload_file" className="text-[18px]" /> Importar Excel/CSV
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        {GRUPOS.map((g) => {
          const hojas = lista.filter((r) => r.categoria === g.categoria)
          if (!hojas.length) return null
          return (
            <div key={g.categoria} className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-label-sm font-bold uppercase tracking-wider text-outline">{g.titulo}</span>
              {hojas.map((r) => (
                <button key={r.id} type="button" onClick={() => setActivo(r.id)} aria-pressed={r.id === recurso.id}
                  className={`rounded-full px-3 py-1 text-label-md transition-colors ${
                    r.id === recurso.id ? 'bg-secondary text-on-secondary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>
                  {r.titulo}
                </button>
              ))}
            </div>
          )
        })}
      </div>

      <RecursoTabla
        key={`${recurso.id}-${version}`}
        recurso={recurso}
        cohortes={cohortes.data ?? []}
        onCambio={recurso.id === 'cohortes' ? cohortes.recargar : undefined}
      />

      {importando && (
        <CsvUploaderModal
          recursos={lista.filter((r) => r.id !== 'parametros')}
          onClose={() => setImportando(false)}
          onImportado={() => {
            cohortes.recargar()
            setVersion((v) => v + 1)
          }}
        />
      )}
    </section>
  )
}
