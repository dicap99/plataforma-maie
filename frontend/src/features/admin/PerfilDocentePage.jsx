import { useEffect, useState } from 'react'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'

const CAMPOS = [
  { name: 'titulacion_maxima', label: 'Titulación máxima' },
  { name: 'formacion_profesional', label: 'Formación profesional', multilinea: true },
  { name: 'campo_formacion', label: 'Campo de formación' },
  { name: 'linea_investigacion', label: 'Línea de investigación' },
  { name: 'componentes', label: 'Componentes de formación que apoya', multilinea: true },
  { name: 'cursos_participa', label: 'Cursos en los que participa', multilinea: true },
  { name: 'enlace_perfil', label: 'Enlace a perfil (CvLAC, ORCID, LinkedIn…)' },
]

// Perfil histórico del docente mantenido por él mismo (RF-ADM-06).
export default function PerfilDocentePage() {
  const { data, error, cargando, recargar } = useApi(adminApi.perfilDocentePropio)
  const [valores, setValores] = useState({})
  const [mensaje, setMensaje] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (data) setValores(Object.fromEntries(CAMPOS.map((c) => [c.name, data[c.name] ?? ''])))
  }, [data])

  if (cargando && !data) return <Cargando />
  if (error) {
    return (
      <>
        <h1>Mi perfil docente</h1>
        <ErrorApi error={error} onReintentar={error.status === 404 ? undefined : recargar} />
      </>
    )
  }

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await adminApi.actualizarPerfilDocentePropio(
        Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v === '' ? null : v])),
      )
      setMensaje({ ok: true, texto: 'Perfil actualizado' })
    } catch (err) {
      setMensaje({ ok: false, texto: err.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <header className="encabezado-pagina">
        <h1>Mi perfil docente</h1>
        <p className="texto-suave">{data.nombre_completo} · {data.afiliacion}</p>
      </header>
      <form className="card" onSubmit={guardar}>
        <div className="form-grid">
          {CAMPOS.map((c) => (
            <div key={c.name} className={`campo${c.multilinea ? ' campo-ancho' : ''}`}>
              <label htmlFor={`p-${c.name}`}>{c.label}</label>
              {c.multilinea ? (
                <textarea id={`p-${c.name}`} rows={3} value={valores[c.name] ?? ''} onChange={(e) => setValores({ ...valores, [c.name]: e.target.value })} />
              ) : (
                <input id={`p-${c.name}`} value={valores[c.name] ?? ''} onChange={(e) => setValores({ ...valores, [c.name]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        {mensaje && <p className={mensaje.ok ? 'texto-exito' : 'alerta-error'} role="status">{mensaje.texto}</p>}
        <button className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
      </form>
    </>
  )
}
