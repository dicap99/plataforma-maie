import * as adminApi from '../../api/adminApi'
import CambiarContrasena from '../auth/CambiarContrasena.jsx'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import { periodoAcademico } from '../../utils/periodo'

const ROMANOS = ['I', 'II', 'III', 'IV']

// Datos que se muestran; todos los registra Coordinación.
const CUENTA = [
  { name: 'identificacion', label: 'Identificación' },
  { name: 'email', label: 'Correo' },
  { name: 'telefono', label: 'Teléfono' },
]
const PERFIL = [
  { name: 'afiliacion', label: 'Afiliación', valor: (p) => (p.afiliacion === 'EXTERNO' ? 'Externo' : p.afiliacion) },
  { name: 'departamento', label: 'Departamento o unidad' },
  { name: 'universidad', label: 'Universidad', solo: (p) => p.afiliacion === 'EXTERNO' },
  { name: 'vinculacion_tipo', label: 'Tipo de vinculación' },
  { name: 'formacion_profesional', label: 'Formación profesional', ancho: true },
  { name: 'campo_formacion', label: 'Campo de formación', etiquetas: (p) => p.campo_formacion?.split(',').map((x) => x.trim()).filter(Boolean) },
  { name: 'linea_investigacion', label: 'Línea de investigación' },
  { name: 'grupo_investigacion', label: 'Grupo de investigación' },
  { name: 'enlace_perfil', label: 'Enlace a perfil (CvLAC, ORCID, LinkedIn…)', enlace: true },
]

const SinRegistrar = () => (
  <span className="inline-flex w-fit items-center gap-1.5 text-body-sm text-outline">
    <Icono nombre="remove_circle_outline" className="text-[16px]" />
    Sin registrar
  </span>
)

function Etiquetas({ valores, tono = 'primario' }) {
  const clase = tono === 'primario' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-secondary-fixed text-on-secondary-fixed-variant'
  return (
    <div className="flex flex-wrap gap-1.5">
      {valores.map((v) => <span key={v} className={`rounded-lg px-2.5 py-0.5 text-label-md ${clase}`}>{v}</span>)}
    </div>
  )
}

function Dato({ etiqueta, ancho = false, children }) {
  const vacio = children === null || children === undefined || children === '' || (Array.isArray(children) && !children.length)
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 rounded-lg bg-surface-container-low/70 p-space-md${ancho ? ' md:col-span-2' : ''}`}>
      <span className="text-label-md text-on-surface-variant">{etiqueta}</span>
      {vacio ? <SinRegistrar /> : <div className="break-words text-body-md font-medium text-on-surface">{children}</div>}
    </div>
  )
}

function Seccion({ icono, tonoIcono, titulo, rotulo, children }) {
  return (
    <section className="flex flex-col gap-space-lg rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-sm">
          <span className={`grid h-9 w-9 place-items-center rounded-lg ${tonoIcono}`}>
            <Icono nombre={icono} className="text-[20px]" />
          </span>
          <h2 className="m-0 font-display text-headline-sm text-primary">{titulo}</h2>
        </div>
        {rotulo && <span className="rounded-lg bg-surface-container-low px-2.5 py-1 text-label-sm text-on-surface-variant">{rotulo}</span>}
      </div>
      {children}
    </section>
  )
}

// Perfil del docente (RF-ADM-06), solo consulta: la cuenta, el perfil y los cursos los registra
// Coordinación (asesoría del 20-oct-2026: docentes y estudiantes no modifican datos). Solo cambia su contraseña.
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

  const cursos = perfil.cursos ?? []
  const componentes = perfil.componentes ?? []

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-col gap-space-md lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center gap-space-sm">
            <span className="text-label-sm font-semibold uppercase tracking-wider text-secondary">Docente MaIE</span>
            <span className="text-outline-variant">•</span>
            <span className="text-label-sm text-on-surface-variant">Periodo {periodoAcademico()}</span>
          </div>
          <h1 className="m-0 font-display text-headline-lg text-primary">Mi perfil docente</h1>
        </div>
        <div className="flex max-w-2xl items-start gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm shadow-sm sm:items-center">
          <Icono nombre="info" className="mt-0.5 shrink-0 text-[20px] text-secondary sm:mt-0" />
          <p className="m-0 text-body-sm text-on-surface-variant">
            <span className="text-label-md text-primary">{perfil.nombre_completo}.</span> Sus datos y sus cursos los registra la
            Coordinación del programa; si algo no es correcto, solicite la corrección.
          </p>
        </div>
      </div>

      <Seccion icono="manage_accounts" tonoIcono="bg-secondary-fixed text-on-secondary-fixed-variant" titulo="Mi cuenta">
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
          {CUENTA.map((c) => <Dato key={c.name} etiqueta={c.label}>{perfil[c.name]}</Dato>)}
        </div>
        <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-low p-space-md">
          <div className="flex items-center gap-space-sm">
            <Icono nombre="lock_reset" className="text-[18px] text-secondary" />
            <span className="text-label-lg text-primary">Seguridad de la cuenta</span>
          </div>
          <CambiarContrasena temporal={perfil.debe_cambiar_password} onCambio={recargar} destacado />
        </div>
      </Seccion>

      <Seccion icono="badge" tonoIcono="bg-primary-fixed text-on-primary-fixed-variant" titulo="Perfil">
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
          {PERFIL.filter((c) => !c.solo || c.solo(perfil)).map((c) => {
            const valor = c.valor ? c.valor(perfil) : perfil[c.name]
            const etiquetas = c.etiquetas?.(perfil)
            return (
              <Dato key={c.name} etiqueta={c.label} ancho={c.ancho}>
                {etiquetas?.length ? <Etiquetas valores={etiquetas} />
                  : c.enlace && valor ? <a href={valor} target="_blank" rel="noreferrer">{valor}</a>
                    : valor}
              </Dato>
            )
          })}
          <Dato etiqueta="Componentes de formación que apoya" ancho>
            {componentes.length ? <Etiquetas valores={componentes} tono="secundario" /> : null}
          </Dato>
        </div>
      </Seccion>

      <Seccion
        icono="library_books"
        tonoIcono="bg-tertiary-fixed text-on-tertiary-fixed-variant"
        titulo="Cursos en los que participa"
        rotulo={`${cursos.length} ${cursos.length === 1 ? 'curso asignado' : 'cursos asignados'}`}
      >
        {cursos.length > 0 ? (
          <div className="tabla-scroll">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="rounded-l-lg px-space-md py-3 text-label-md text-on-surface-variant">Promoción</th>
                  <th className="px-space-md py-3 text-label-md text-on-surface-variant">Periodo</th>
                  <th className="px-space-md py-3 text-label-md text-on-surface-variant">Curso</th>
                  <th className="px-space-md py-3 text-label-md text-on-surface-variant">Componente</th>
                  <th className="rounded-r-lg px-space-md py-3 text-right text-label-md text-on-surface-variant">Docentes</th>
                </tr>
              </thead>
              <tbody>
                {cursos.map((c) => (
                  <tr key={c.id_curso} className="transition-colors hover:bg-surface-container-low/50">
                    <td className="px-space-md py-3.5 text-body-md font-medium text-on-surface">{c.cohorte}</td>
                    <td className="px-space-md py-3.5 text-body-md text-on-surface-variant">
                      {c.periodo} · semestre {ROMANOS[c.semestre - 1] ?? c.semestre}
                    </td>
                    <td className="px-space-md py-3.5 text-body-md font-semibold text-primary">{c.clase}</td>
                    <td className="px-space-md py-3.5">
                      <span className="rounded-lg bg-secondary-fixed px-2.5 py-0.5 text-label-md text-on-secondary-fixed-variant">{c.componente}</span>
                    </td>
                    <td className="px-space-md py-3.5 text-right text-body-md font-medium text-on-surface">{c.docentes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 text-body-sm text-on-surface-variant">Aún no hay cursos registrados.</p>
        )}
      </Seccion>
    </div>
  )
}
