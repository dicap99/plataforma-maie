import * as adminApi from '../../api/adminApi'
import CambiarContrasena from '../auth/CambiarContrasena.jsx'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'

const ROMANOS = ['I', 'II', 'III', 'IV']

// Datos que se muestran del perfil; los registra Coordinación.
const CUENTA = [
  { name: 'identificacion', label: 'Identificación' },
  { name: 'email', label: 'Correo (inicio de sesión)' },
  { name: 'telefono', label: 'Teléfono' },
]
const PERFIL = [
  { name: 'afiliacion', label: 'Afiliación', valor: (p) => (p.afiliacion === 'EXTERNO' ? 'Externo' : p.afiliacion) },
  { name: 'departamento', label: 'Departamento o unidad' },
  { name: 'universidad', label: 'Universidad', solo: (p) => p.afiliacion === 'EXTERNO' },
  { name: 'vinculacion_tipo', label: 'Tipo de vinculación' },
  { name: 'formacion_profesional', label: 'Formación profesional', ancho: true },
  { name: 'campo_formacion', label: 'Campo de formación' },
  { name: 'linea_investigacion', label: 'Línea de investigación' },
  { name: 'grupo_investigacion', label: 'Grupo de investigación' },
  { name: 'enlace_perfil', label: 'Enlace a perfil (CvLAC, ORCID, LinkedIn…)' },
]

function Dato({ etiqueta, children, ancho = false }) {
  return (
    <div className={`campo${ancho ? ' campo-ancho' : ''}`}>
      <span className="etiqueta">{etiqueta}</span>
      <p className="m-0">{children || <span className="texto-suave">Sin registrar</span>}</p>
    </div>
  )
}

// Perfil del docente (RF-ADM-06), solo consulta: la cuenta, el perfil y los cursos los registra
// Coordinación (asesoría del 20-oct-2026: docentes y estudiantes no modifican datos).
export default function PerfilDocentePage() {
  const { data: perfil, error, cargando, recargar } = useApi(adminApi.perfilDocentePropio)

  if (cargando && !perfil) return <Cargando />
  if (error) {
    return (
      <>
        <h1>Mi perfil docente</h1>
        <ErrorApi error={error} onReintentar={error.status === 404 ? undefined : recargar} />
      </>
    )
  }
  if (!perfil) return <Cargando />

  return (
    <>
      <header className="encabezado-pagina">
        <h1>Mi perfil docente</h1>
        <p className="texto-suave">
          {perfil.nombre_completo}. Sus datos y sus cursos los registra la Coordinación del programa; si algo no es correcto,
          solicite la corrección.
        </p>
      </header>

      <section className="card">
        <h2>Mi cuenta</h2>
        <div className="form-grid">
          {CUENTA.map((c) => <Dato key={c.name} etiqueta={c.label}>{perfil[c.name]}</Dato>)}
        </div>
        <CambiarContrasena temporal={perfil.debe_cambiar_password} onCambio={recargar} />
      </section>

      <section className="card">
        <h2>Perfil</h2>
        <div className="form-grid">
          {PERFIL.filter((c) => !c.solo || c.solo(perfil)).map((c) => (
            <Dato key={c.name} etiqueta={c.label} ancho={c.ancho}>{c.valor ? c.valor(perfil) : perfil[c.name]}</Dato>
          ))}
          <Dato etiqueta="Componentes de formación que apoya" ancho>{perfil.componentes?.join(', ')}</Dato>
        </div>
      </section>

      <section className="card">
        <h2>Cursos en los que participa</h2>
        {perfil.cursos.length > 0 ? (
          <div className="tabla-scroll">
            <table className="tabla-compacta">
              <thead>
                <tr><th>Promoción</th><th>Periodo</th><th>Curso</th><th>Componente</th><th className="num">Docentes</th></tr>
              </thead>
              <tbody>
                {perfil.cursos.map((c) => (
                  <tr key={c.id_curso}>
                    <td>{c.cohorte}</td>
                    <td>{c.periodo} · semestre {ROMANOS[c.semestre - 1] ?? c.semestre}</td>
                    <td>{c.clase}</td>
                    <td>{c.componente}</td>
                    <td className="num">{c.docentes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="texto-suave">Aún no hay cursos registrados.</p>
        )}
      </section>
    </>
  )
}
