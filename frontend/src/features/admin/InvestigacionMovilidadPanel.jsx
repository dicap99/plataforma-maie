import { useState } from 'react'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import Modal from '../../components/common/Modal.jsx'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import RecursoTabla from './RecursoTabla.jsx'

// «Investigación y movilidad» en Gestión académica › Datos del programa › Académicas (decisión del usuario,
// 2026-11-24): un apartado por tipo de producto de investigación (hoja «Productos de investigación», de la que
// se calculan los totales de «Producción científica» de cada promoción) y las pasantías (movilidad). Aquí se
// registra también qué estudiantes participaron en cada producto; su ficha de usuario solo lo consulta.
const APARTADOS = [
  { id: 'articulos', titulo: 'Artículos', tipo: 'Artículo' },
  { id: 'ponencias', titulo: 'Ponencias', tipo: 'Ponencia' },
  { id: 'software', titulo: 'Software', tipo: 'Software' },
  { id: 'prototipos', titulo: 'Prototipos', tipo: 'Prototipo' },
  { id: 'tesis', titulo: 'Tesis', tipo: 'Tesis' },
  { id: 'pasantias', titulo: 'Pasantías', recurso: 'pasantias-detalle' },
]

// Estudiantes registrados de la promoción del producto: se marcan los que participaron.
function EstudiantesDelProducto({ producto, onClose }) {
  const datos = useApi(() => adminApi.estudiantesDeProducto(producto.id_producto), [producto.id_producto])
  const [marcados, setMarcados] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const lista = datos.data?.estudiantes ?? []
  const actuales = marcados ?? new Set(lista.filter((e) => e.vinculado).map((e) => e.id_usuario))
  const alternar = (id) => setMarcados(() => { const n = new Set(actuales); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await adminApi.vincularEstudiantes(producto.id_producto, [...actuales])
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }
  return (
    <Modal titulo={`Estudiantes · ${producto.tipo}`} onClose={onClose} ancho={640}>
      <div className="flex flex-col gap-space-sm">
        <p className="m-0 text-body-sm text-on-surface-variant">{producto.cita}</p>
        {producto.estudiantes && <p className="m-0 texto-suave">Participantes según el registro: {producto.estudiantes}</p>}
        <ErrorApi error={datos.error ?? error} onReintentar={datos.recargar} />
        {datos.cargando && !datos.data ? <Cargando /> : (
          lista.length ? (
            <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
              {lista.map((e) => (
                <label key={e.id_usuario} className="flex items-center gap-2 text-body-sm">
                  <input type="checkbox" checked={actuales.has(e.id_usuario)} onChange={() => alternar(e.id_usuario)} />
                  <span>{e.apellidos} {e.nombres} <span className="texto-suave">· {e.identificacion}</span></span>
                </label>
              ))}
            </div>
          ) : <p className="m-0 texto-suave">La promoción {datos.data?.producto.cohorte} no tiene estudiantes registrados (Usuarios).</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primario" disabled={guardando || !lista.length} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </Modal>
  )
}

export default function InvestigacionMovilidadPanel({ recursos, cohortes, apartadoInicial }) {
  const [activo, setActivo] = useState(APARTADOS.some((a) => a.id === apartadoInicial) ? apartadoInicial : APARTADOS[0].id)
  const [participantesDe, setParticipantesDe] = useState(null)
  const apartado = APARTADOS.find((a) => a.id === activo)
  const recurso = recursos.find((r) => r.id === (apartado.recurso ?? 'productos'))

  return (
    <div className="flex flex-col gap-space-md">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Apartados de investigación y movilidad">
        {APARTADOS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={a.id === activo} onClick={() => setActivo(a.id)}
            className={`rounded-lg border px-3 py-1 text-label-md transition-colors ${
              a.id === activo ? 'border-secondary bg-secondary/10 font-semibold text-secondary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
            {a.titulo}
          </button>
        ))}
      </div>
      {apartado.tipo ? (
        <p className="m-0 text-body-sm text-on-surface-variant">
          {apartado.titulo} de los estudiantes, con su cita bibliográfica. Con «Estudiantes» se marcan los estudiantes registrados
          que participaron (aparecen en su ficha). Los totales de «Producción científica» de cada promoción se calculan de estos
          registros; las promociones sin registros conservan el histórico del libro.
        </p>
      ) : (
        <p className="m-0 text-body-sm text-on-surface-variant">
          Registro detallado de cada pasantía (nacional o internacional), con estudiante, institución, fechas y control de soporte
          documental (sin subir archivos). Las promociones con registros detallados calculan automáticamente los totales de «Pasantías».
        </p>
      )}
      {recurso ? (
        <RecursoTabla
          key={apartado.id}
          recurso={recurso}
          cohortes={cohortes}
          apartado={apartado.tipo ? { filtrar: (f) => f.tipo === apartado.tipo, valores: { tipo: apartado.tipo } } : undefined}
          accionExtra={apartado.tipo ? { etiqueta: 'Estudiantes', onClick: setParticipantesDe } : undefined}
        />
      ) : <p className="texto-suave">No hay datos disponibles para su rol.</p>}
      {participantesDe && <EstudiantesDelProducto producto={participantesDe} onClose={() => setParticipantesDe(null)} />}
    </div>
  )
}
