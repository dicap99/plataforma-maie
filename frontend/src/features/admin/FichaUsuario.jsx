import * as usuariosApi from '../../api/usuariosApi'
import useApi from '../../hooks/useApi'
import Modal from '../../components/common/Modal.jsx'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import { ETIQUETA_ROL } from '../../routes/navigation'
import { ROMANOS, etiquetaBeca, etiquetaBeneficio } from './beneficios/tipos'

// Ficha de detalle de un usuario según su rol (Gestión académica › Usuarios, decisión del usuario 2026-11-24).
// Solo consulta: en Usuarios se registra la información básica; las particularidades (materias, beneficios,
// producción) se registran en su sección. Lo que falta se muestra como pendiente.
const PENDIENTE = 'Sin registrar todavía (se completa con la información de Coordinación).'

function Apartado({ titulo, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 font-display text-title-md text-primary">{titulo}</h3>
      {children}
    </section>
  )
}

const Pendiente = ({ texto = PENDIENTE }) => <p className="m-0 texto-suave italic">{texto}</p>

// Materias agrupadas por semestre académico; las del componente electivo se rotulan.
function TablaMaterias({ materias, conPromocion = false, conDocentes = true }) {
  if (!materias.length) return <Pendiente />
  return (
    <div className="tabla-scroll">
      <table className="text-body-sm">
        <thead>
          <tr>
            <th>Semestre</th><th>Materia</th><th>Curso del plan</th><th>Componente</th>
            {conPromocion && <th>Promoción</th>}{conDocentes && <th>Docentes</th>}
          </tr>
        </thead>
        <tbody>
          {materias.map((m) => (
            <tr key={`${m.id_curso}`}>
              <td>{m.periodo}</td>
              <td>{m.materia}{m.grupo > 1 && ` · grupo ${m.grupo}`}</td>
              <td>{m.curso_codigo} · sem. {m.semestre_plan}</td>
              <td>{m.componente === 'Electivo'
                ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-label-sm font-semibold text-amber-800">Electiva</span>
                : m.componente}</td>
              {conPromocion && <td>{m.cohorte}</td>}
              {conDocentes && <td>{m.docentes || <span className="texto-suave">—</span>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Producción académica del estudiante (solo consulta: se registra en Datos del programa › Investigación y
// movilidad, botón «Estudiantes» de cada producto).
function Produccion({ produccion }) {
  return (
    <Apartado titulo="Producción académica">
      {produccion.length ? (
        <ul className="m-0 flex flex-col gap-1 pl-5 text-body-sm">
          {produccion.map((p) => (
            <li key={p.id_producto}><strong>{p.tipo}</strong>{p.anio ? ` (${p.anio})` : ''}: {p.cita}</li>
          ))}
        </ul>
      ) : <Pendiente texto="Sin producción registrada (Datos del programa › Investigación y movilidad)." />}
    </Apartado>
  )
}

export default function FichaUsuario({ usuario, onClose }) {
  const ficha = useApi(() => usuariosApi.ficha(usuario.id_usuario), [usuario.id_usuario])
  const f = ficha.data
  const u = f?.usuario ?? usuario
  const beneficiosPorSemestre = (f?.beneficios ?? []).reduce((m, b) => m.set(b.semestre, [...(m.get(b.semestre) ?? []), etiquetaBeneficio(b.tipo)]), new Map())

  return (
    <Modal titulo={`${u.nombres} ${u.apellidos} · ${ETIQUETA_ROL[u.rol] ?? u.rol}`} onClose={onClose} ancho={900}>
      <div className="flex max-h-[75vh] flex-col gap-space-md overflow-y-auto">
        <p className="m-0 text-body-sm text-on-surface-variant">
          {u.identificacion && <>Identificación {u.identificacion} · </>}{u.email}{u.telefono ? ` · ${u.telefono}` : ''} · {u.activo ? 'Activo' : 'Inactivo'}
        </p>
        <ErrorApi error={ficha.error} onReintentar={ficha.recargar} />
        {ficha.cargando && !f ? <Cargando /> : f && (
          <>
            {u.rol === 'estudiante' && (
              <>
                <Apartado titulo="Programa">
                  {f.promociones.length ? f.promociones.map((p) => (
                    <p key={p.id_cohorte} className="m-0 text-body-sm">
                      Posgrado · <strong>Promoción {p.cohorte}</strong> ({p.periodo_inicio} a {p.periodo_fin ?? 'en curso'}) · {p.estado}
                      {p.beca ? ` · ${etiquetaBeca(p.beca)}` : ''}{p.fecha_grado ? ` · grado ${String(p.fecha_grado).slice(0, 10)}` : ''}
                    </p>
                  )) : f.pregrado.length
                    ? <p className="m-0 text-body-sm">Pregrado · cursa materias de la maestría</p>
                    : <Pendiente texto="Sin promoción ni materias registradas: indique si es de posgrado (promoción) o de pregrado." />}
                </Apartado>
                {f.promociones.length > 0 && (
                  <>
                    <Apartado titulo="Materias matriculadas"><TablaMaterias materias={f.materias} /></Apartado>
                    <Apartado titulo="Beneficios por semestre">
                      {beneficiosPorSemestre.size ? (
                        <ul className="m-0 flex flex-col gap-1 pl-5 text-body-sm">
                          {[...beneficiosPorSemestre.entries()].map(([s, l]) => <li key={s}>Semestre {ROMANOS[s - 1]}: {l.join(' + ')}</li>)}
                        </ul>
                      ) : <Pendiente texto="Sin beneficios registrados (Datos del programa › Beneficios)." />}
                    </Apartado>
                    <Produccion produccion={f.produccion} />
                  </>
                )}
                {f.pregrado.length > 0 && (
                  <Apartado titulo="Materias de la maestría (pregrado)"><TablaMaterias materias={f.pregrado} conPromocion /></Apartado>
                )}
              </>
            )}
            {u.rol === 'docente' && (
              <>
                <Apartado titulo="Perfil">
                  {f.perfil ? (
                    <dl className="m-0 grid grid-cols-1 gap-x-space-md gap-y-1 text-body-sm sm:grid-cols-2">
                      {[
                        ['Afiliación', f.perfil.afiliacion === 'EXTERNO' ? ['Externo', f.perfil.universidad].filter(Boolean).join(' · ') : ['UDENAR', f.perfil.departamento].filter(Boolean).join(' · ')],
                        ['Vinculación', f.perfil.vinculacion_tipo], ['Formación profesional', f.perfil.formacion_profesional],
                        ['Campos de formación', f.perfil.campo_formacion], ['Línea de investigación', f.perfil.linea_investigacion],
                        ['Grupo de investigación', f.perfil.grupo_investigacion],
                      ].map(([k, v]) => (
                        <div key={k}><dt className="inline font-semibold">{k}: </dt><dd className="m-0 inline">{v || <span className="texto-suave">sin registrar</span>}</dd></div>
                      ))}
                    </dl>
                  ) : <Pendiente texto="Sin perfil docente vinculado." />}
                </Apartado>
                <Apartado titulo="Materias que ha dictado"><TablaMaterias materias={f.materias} conPromocion conDocentes={false} /></Apartado>
              </>
            )}
            {u.rol === 'coordinador' && <p className="m-0 texto-suave">La cuenta de Coordinación no tiene detalles adicionales.</p>}
          </>
        )}
      </div>
    </Modal>
  )
}
