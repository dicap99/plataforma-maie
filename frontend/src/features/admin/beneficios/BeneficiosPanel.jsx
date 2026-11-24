import { useState } from 'react'
import * as usuariosApi from '../../../api/usuariosApi'
import * as adminApi from '../../../api/adminApi'
import useApi from '../../../hooks/useApi'
import Modal from '../../../components/common/Modal.jsx'
import { Cargando, ErrorApi } from '../../../components/common/Estado.jsx'
import BeneficiosPorSemestre from './BeneficiosPorSemestre.jsx'
import { ROMANOS, SEMESTRES, etiquetaBeca, etiquetaBeneficio } from './tipos'

// «Beneficios» de Gestión académica › Datos del programa › Académicas (asesoría del 20-oct-2026): becas, asistencias de
// investigación y ayudantías de docencia de cada estudiante por semestre de su promoción. El usuario
// solo se registra como estudiante de una promoción (pestaña Usuarios); aquí se editan sus beneficios,
// que alimentan la hoja «Beneficios» de Información académica.
export default function BeneficiosPanel() {
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const [elegida, setElegida] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)

  const lista = [...(cohortes.data ?? [])].sort((a, b) => (a.periodo_inicio < b.periodo_inicio ? 1 : -1))
  const idCohorte = elegida || (lista[0] ? String(lista[0].id_cohorte) : '')
  const estudiantes = useApi(
    () => (idCohorte ? usuariosApi.beneficiosDePromocion(idCohorte) : Promise.resolve({ data: [] })),
    [idCohorte],
  )

  if (cohortes.cargando && !cohortes.data) return <Cargando />
  if (cohortes.error) return <ErrorApi error={cohortes.error} onReintentar={cohortes.recargar} />

  const q = busqueda.trim().toLowerCase()
  const visibles = (estudiantes.data ?? []).filter((e) => !q || `${e.nombres} ${e.apellidos} ${e.identificacion}`.toLowerCase().includes(q))
  const delSemestre = (e, s) => e.beneficios.filter((b) => b.semestre === s).map((b) => etiquetaBeneficio(b.tipo)).join(' + ')

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-wrap items-end gap-space-sm">
        <div className="campo">
          <label htmlFor="b-promocion">Promoción</label>
          <select id="b-promocion" value={idCohorte} onChange={(e) => setElegida(e.target.value)}>
            {lista.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>Promoción {c.nombre} ({c.periodo_inicio})</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="b-buscar">Buscar</label>
          <input id="b-buscar" type="search" placeholder="Nombre o identificación" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>
      <p className="m-0 texto-suave">
        Los estudiantes se asignan a su promoción en la pestaña Usuarios. Una sola beca por semestre; las asistencias de
        investigación y las ayudantías de docencia se suman a ella.
      </p>

      <ErrorApi error={estudiantes.error} onReintentar={estudiantes.recargar} />
      {estudiantes.cargando && !estudiantes.data ? <Cargando /> : estudiantes.data && (
        <div className="card tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Estudiante</th><th>Identificación</th>
                {SEMESTRES.map((s) => <th key={s}>Semestre {ROMANOS[s - 1]}</th>)}
                <th><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((e) => (
                <tr key={e.id_usuario}>
                  <td>
                    {e.apellidos} {e.nombres}
                    {!e.beneficios.length && e.beca && (
                      <div className="texto-suave">{etiquetaBeca(e.beca)} registrada sin semestres</div>
                    )}
                  </td>
                  <td>{e.identificacion}</td>
                  {SEMESTRES.map((s) => <td key={s}>{delSemestre(e, s) || <span className="texto-suave">—</span>}</td>)}
                  <td className="acciones">
                    <button type="button" className="btn-enlace" onClick={() => setEditando(e)}>Editar</button>
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr><td colSpan={7} className="texto-suave">
                  {q ? 'Ningún estudiante coincide con la búsqueda.' : 'La promoción no tiene estudiantes registrados.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <EditarBeneficios estudiante={editando} idCohorte={idCohorte} onClose={() => setEditando(null)} onGuardado={estudiantes.recargar} />
      )}
    </div>
  )
}

// Edita los beneficios del estudiante en la promoción elegida en la pestaña. «Guardar» se habilita solo
// si hubo cambios: así no se pierde por accidente una beca registrada sin semestres.
function EditarBeneficios({ estudiante, idCohorte, onClose, onGuardado }) {
  const [beneficios, setBeneficios] = useState(estudiante.beneficios)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const clave = (lista) => lista.map((b) => `${b.semestre}|${b.tipo}`).sort().join(',')
  const sinCambios = clave(beneficios) === clave(estudiante.beneficios)

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await usuariosApi.reemplazarBeneficios(estudiante.id_usuario, idCohorte, beneficios)
      onGuardado()
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={`Beneficios de ${estudiante.nombres} ${estudiante.apellidos}`} onClose={onClose} ancho={640}>
      <form onSubmit={guardar} className="flex flex-col gap-space-sm">
        <BeneficiosPorSemestre beneficios={beneficios} onChange={setBeneficios} />
        {!estudiante.beneficios.length && estudiante.beca && (
          <p className="m-0 texto-suave">
            Tiene registrada la {etiquetaBeca(estudiante.beca).toLowerCase()} para la promoción, sin semestres. Márquela en
            los semestres en que la recibió.
          </p>
        )}
        <ErrorApi error={error} />
        <div className="modal-acciones">
          <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primario" disabled={guardando || sinCambios}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}
