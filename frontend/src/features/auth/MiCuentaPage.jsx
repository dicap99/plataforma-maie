import * as authApi from '../../api/authApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import { ETIQUETA_ROL } from '../../routes/navigation'
import CambiarContrasena from './CambiarContrasena.jsx'

const DATOS = [
  { name: 'identificacion', label: 'Identificación' },
  { name: 'email', label: 'Correo (inicio de sesión)' },
  { name: 'telefono', label: 'Teléfono' },
  { name: 'rol', label: 'Rol', valor: (u) => ETIQUETA_ROL[u.rol] ?? u.rol },
]

// Mi cuenta (todos los roles): consulta de los datos de la cuenta, que gestiona Coordinación, y cambio de
// la contraseña propia. El docente tiene además su perfil en «Mi perfil».
export default function MiCuentaPage() {
  const cuenta = useApi(authApi.me)
  if (cuenta.cargando && !cuenta.data) return <Cargando />
  if (cuenta.error) return <ErrorApi error={cuenta.error} onReintentar={cuenta.recargar} />
  const u = cuenta.data

  return (
    <>
      <header className="encabezado-pagina">
        <h1>Mi cuenta</h1>
        <p className="texto-suave">
          {u.nombres} {u.apellidos}. Sus datos los registra la Coordinación del programa; si algo no es correcto, solicite la
          corrección.
        </p>
      </header>
      <section className="card">
        <h2>Datos de la cuenta</h2>
        <div className="form-grid">
          {DATOS.map((d) => (
            <div key={d.name} className="campo">
              <span className="etiqueta">{d.label}</span>
              <p className="m-0">{(d.valor ? d.valor(u) : u[d.name]) || <span className="texto-suave">Sin registrar</span>}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>Contraseña</h2>
        <CambiarContrasena temporal={u.debe_cambiar_password} />
      </section>
    </>
  )
}
