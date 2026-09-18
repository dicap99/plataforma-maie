import { useState } from 'react'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import RecursoTabla from './RecursoTabla.jsx'
import CsvUploaderModal from './CsvUploaderModal.jsx'

// "Datos del programa": una pestaña por hoja de «Estadísticas MaIE» (RF-ADM-01 a RF-ADM-06).
// Las pestañas visibles dependen del rol (el API solo devuelve los recursos que el rol puede leer).
export default function DatosProgramaPage() {
  const recursos = useApi(adminApi.listarRecursos)
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const [activo, setActivo] = useState('cohortes')
  const [importando, setImportando] = useState(false)
  const [version, setVersion] = useState(0) // fuerza recarga de la tabla tras importar

  if (recursos.cargando && !recursos.data) return <Cargando />
  if (recursos.error) return <ErrorApi error={recursos.error} onReintentar={recursos.recargar} />

  const lista = recursos.data
  if (lista.length === 0) return <p className="texto-suave">Su rol no tiene acceso a los datos del programa.</p>
  const recurso = lista.find((r) => r.id === activo) ?? lista[0]
  const puedeEditar = lista.some((r) => r.editable)

  return (
    <>
      <header className="encabezado-pagina">
        <h1>Datos del programa</h1>
        {puedeEditar && (
          <div className="acciones-pagina">
            <button type="button" className="btn btn-secundario" onClick={() => adminApi.descargarPlantilla(true)}>
              Exportar a Excel
            </button>
            <button type="button" className="btn btn-primario" onClick={() => setImportando(true)}>
              Importar Excel/CSV
            </button>
          </div>
        )}
      </header>

      <div className="pestanas" role="tablist" aria-label="Hojas de datos">
        {lista.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={r.id === recurso.id}
            className={r.id === recurso.id ? 'activa' : ''}
            onClick={() => setActivo(r.id)}
          >
            {r.titulo}
          </button>
        ))}
      </div>

      <RecursoTabla
        key={`${recurso.id}-${version}`}
        recurso={recurso}
        cohortes={cohortes.data ?? []}
        onCambio={recurso.id === 'cohortes' ? cohortes.recargar : undefined}
      />

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
    </>
  )
}
