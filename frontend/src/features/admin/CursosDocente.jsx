import { useState } from 'react'
import * as adminApi from '../../api/adminApi'
import * as cursosApi from '../../api/cursosApi'
import useApi from '../../hooks/useApi'

const ROMANOS = ['I', 'II', 'III', 'IV']

// Los cuatro periodos de una promoción a partir de su periodo de inicio (2021-A → 2021-A, 2021-B, 2022-A, 2022-B).
const periodosDe = (inicio) => {
  if (!inicio) return []
  let anio = Number(inicio.slice(0, 4))
  let mitad = inicio.endsWith('B') ? 1 : 0
  return ROMANOS.map((romano) => {
    const periodo = `${anio}-${mitad ? 'B' : 'A'}`
    mitad = 1 - mitad
    if (!mitad) anio += 1
    return { periodo, semestre: romano }
  })
}

// Cursos en los que participa un docente (RF-ADM-06): registrar uno es elegir promoción, periodo y
// curso; cuenta de inmediato en «Cursos y docentes por semestre» y define los componentes que apoya.
// `idDocente` vacío = el docente de la sesión; con id, lo hace Coordinación por ese docente.
export default function CursosDocente({ cursos = [], idDocente, onCambio }) {
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const clases = useApi(() => cursosApi.listarClases())
  const [nuevo, setNuevo] = useState({ id_cohorte: '', periodo: '', id_clase: '' })
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const cohorte = (cohortes.data ?? []).find((c) => String(c.id_cohorte) === nuevo.id_cohorte)
  const periodos = periodosDe(cohorte?.periodo_inicio)

  const ejecutar = async (accion, texto) => {
    setOcupado(true)
    setMensaje(null)
    try {
      const { data } = await accion()
      onCambio?.(data)
      setMensaje({ ok: true, texto })
      return true
    } catch (err) {
      setMensaje({ ok: false, texto: err.message })
      return false
    } finally {
      setOcupado(false)
    }
  }

  const agregar = async (e) => {
    e.preventDefault()
    const datos = { id_cohorte: Number(nuevo.id_cohorte), periodo: nuevo.periodo, id_clase: Number(nuevo.id_clase) }
    if (await ejecutar(() => adminApi.agregarCursoDocente(datos, idDocente), 'Curso registrado')) {
      setNuevo({ ...nuevo, id_clase: '' })
    }
  }

  return (
    <section className="card">
      <h2>Cursos en los que participa</h2>
      <p className="texto-suave">
        Registre cada curso que dictó o dicta: promoción, periodo y curso. El componente de formación sale del curso
        y la tabla «Cursos y docentes por semestre» se actualiza sola.
      </p>

      {cursos.length > 0 ? (
        <div className="tabla-scroll">
          <table className="tabla-compacta">
            <thead>
              <tr><th>Promoción</th><th>Periodo</th><th>Curso</th><th>Componente</th><th className="num">Docentes</th><th aria-label="Acciones" /></tr>
            </thead>
            <tbody>
              {cursos.map((c) => (
                <tr key={c.id_curso}>
                  <td>{c.cohorte}</td>
                  <td>{c.periodo} · semestre {ROMANOS[c.semestre - 1] ?? c.semestre}</td>
                  <td>{c.clase}</td>
                  <td>{c.componente}</td>
                  <td className="num">{c.docentes}</td>
                  <td>
                    <button type="button" className="btn-enlace" disabled={ocupado}
                      onClick={() => ejecutar(() => adminApi.quitarCursoDocente(c.id_curso, idDocente), 'Curso quitado')}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="texto-suave">Aún no hay cursos registrados.</p>
      )}

      <form className="form-grid" onSubmit={agregar} style={{ marginTop: '1rem' }}>
        <div className="campo">
          <label htmlFor="cd-cohorte">Promoción</label>
          <select id="cd-cohorte" required value={nuevo.id_cohorte} onChange={(e) => setNuevo({ id_cohorte: e.target.value, periodo: '', id_clase: nuevo.id_clase })}>
            <option value="">Seleccione…</option>
            {(cohortes.data ?? []).map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>Promoción {c.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="cd-periodo">Periodo</label>
          <select id="cd-periodo" required value={nuevo.periodo} disabled={!cohorte} onChange={(e) => setNuevo({ ...nuevo, periodo: e.target.value })}>
            <option value="">Seleccione…</option>
            {periodos.map((p) => <option key={p.periodo} value={p.periodo}>{p.periodo} · semestre {p.semestre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="cd-clase">Curso</label>
          <select id="cd-clase" required value={nuevo.id_clase} onChange={(e) => setNuevo({ ...nuevo, id_clase: e.target.value })}>
            <option value="">Seleccione…</option>
            {(clases.data ?? []).map((c) => <option key={c.id_clase} value={c.id_clase}>{c.nombre} ({c.modulo})</option>)}
          </select>
        </div>
        <div className="campo" style={{ alignSelf: 'end' }}>
          <button className="btn btn-primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Registrar curso'}</button>
        </div>
      </form>
      {mensaje && <p className={mensaje.ok ? 'texto-exito' : 'alerta-error'} role="status">{mensaje.texto}</p>}
    </section>
  )
}
