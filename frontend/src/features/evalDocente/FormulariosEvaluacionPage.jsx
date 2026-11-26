import { useState } from 'react'
import * as evalApi from '../../api/evalDocenteApi'
import useApi from '../../hooks/useApi'
import Modal from '../../components/common/Modal.jsx'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import { Encabezado, ETIQUETA_FORMULARIO, Seccion } from './comun.jsx'

// «Formularios» de la evaluación docente (Acuerdo 058, Art. 8: el Comité Curricular puede modificar las
// características y variables). Un solo formulario por tipo para todos los semestres; los cambios aplican a las
// evaluaciones que se diligencien desde ese momento. Una pregunta con respuestas no cambia de redacción: se
// desactiva y se agrega otra (los resultados de cada semestre conservan las preguntas que se respondieron).
const TIPOS = ['EE', 'EC', 'AE']

function EditorPregunta({ tipo, pregunta, caracteristica, caracteristicas, onClose, onGuardada }) {
  const nueva = !pregunta
  const [c, setC] = useState(caracteristica ?? (caracteristicas.at(-1)?.numero ?? 0) + 1)
  const existente = caracteristicas.find((x) => x.numero === Number(c))
  const [nombre, setNombre] = useState('')
  const [texto, setTexto] = useState(pregunta?.texto ?? '')
  const [escala, setEscala] = useState(pregunta?.escala ?? '')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      if (nueva) {
        await evalApi.crearPregunta(tipo, { caracteristica: Number(c), nombre_caracteristica: existente ? undefined : nombre, texto, escala: escala || null })
      } else {
        await evalApi.actualizarPregunta(pregunta.id_pregunta, { texto, escala: escala || null })
      }
      onGuardada()
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }
  return (
    <Modal titulo={nueva ? `Nueva pregunta · ${ETIQUETA_FORMULARIO[tipo] ?? tipo}` : `Editar pregunta ${pregunta.codigo}`} onClose={onClose} ancho={640}>
      <form onSubmit={guardar} className="flex flex-col gap-space-sm">
        <ErrorApi error={error} />
        {nueva && (
          <div className="campo">
            <label htmlFor="fp-c">Característica</label>
            <select id="fp-c" value={c} onChange={(e) => setC(e.target.value)}>
              {caracteristicas.map((x) => <option key={x.numero} value={x.numero}>C{x.numero}. {x.nombre}</option>)}
              {[...Array(10).keys()].filter((n) => !caracteristicas.some((x) => x.numero === n)).map((n) => (
                <option key={n} value={n}>C{n} (nueva característica)</option>
              ))}
            </select>
          </div>
        )}
        {nueva && !existente && (
          <div className="campo">
            <label htmlFor="fp-n">Nombre de la característica nueva</label>
            <input id="fp-n" value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={3} maxLength={120} />
          </div>
        )}
        <div className="campo">
          <label htmlFor="fp-t">Pregunta (característica o variable)</label>
          <textarea id="fp-t" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} required minLength={3} maxLength={500} />
        </div>
        <div className="campo">
          <label htmlFor="fp-e">Escala propia (opcional)</label>
          <input id="fp-e" value={escala} onChange={(e) => setEscala(e.target.value)} maxLength={300}
            placeholder="Solo si la pregunta define sus rangos, p. ej. «MA: (100 - 90)%; A: (89 - 60)%…»" />
        </div>
        <p className="m-0 texto-suave">Se responde con Muy adecuada, Adecuada, Inadecuada, Muy inadecuada o No aplica (Art. 1). El cambio aplica a las evaluaciones que se diligencien desde ahora.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function FormulariosEvaluacionPage() {
  const [tipo, setTipo] = useState('EE')
  const [editando, setEditando] = useState(false)
  const preguntas = useApi(() => evalApi.preguntasFormulario(tipo), [tipo])
  const [editor, setEditor] = useState(null) // null | { pregunta? , caracteristica? }
  const [error, setError] = useState(null)

  const lista = preguntas.data ?? []
  const caracteristicas = [...new Map(lista.map((p) => [p.caracteristica, { numero: p.caracteristica, nombre: p.nombre_caracteristica }])).values()]
    .sort((a, b) => a.numero - b.numero)
  const accion = async (fn) => {
    setError(null)
    try {
      await fn()
      await preguntas.recargar()
    } catch (err) {
      setError(err)
    }
  }
  const eliminar = (p) => {
    if (!window.confirm(`¿Eliminar la pregunta ${p.codigo}? Esta acción no se puede deshacer.`)) return
    accion(() => evalApi.eliminarPregunta(p.id_pregunta))
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <Encabezado icono="quiz" titulo="Formularios">
        Preguntas de los formularios del Acuerdo 058 de 2022 (Art. 4 a 6). El Comité Curricular puede modificarlas (Art. 8). Hay un
        solo formulario de cada tipo para todos los semestres; los cambios aplican a las evaluaciones que se diligencien desde ese
        momento. Por seguridad, el formulario se muestra en solo lectura; active «Editar formulario» si desea hacer cambios.
      </Encabezado>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Formularios">
          {TIPOS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={t === tipo} onClick={() => { setTipo(t); setEditando(false) }}
              className={`rounded-lg border px-3 py-1 text-label-md transition-colors ${
                t === tipo ? 'border-secondary bg-secondary/10 font-semibold text-secondary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
              {ETIQUETA_FORMULARIO[t] ?? t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {!editando ? (
            <button type="button" className="btn btn-secundario" onClick={() => setEditando(true)}>
              <Icono nombre="edit" className="text-[18px]" /> Editar formulario
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-primario" onClick={() => setEditor({})}>
                <Icono nombre="add" className="text-[18px]" /> Nueva pregunta
              </button>
              <button type="button" className="btn btn-secundario" onClick={() => setEditando(false)}>
                <Icono nombre="lock" className="text-[18px]" /> Finalizar edición
              </button>
            </>
          )}
        </div>
      </div>

      {editando && (
        <p className="m-0 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-body-sm text-amber-900" role="status">
          <Icono nombre="edit_note" className="text-[18px]" />
          Modo de edición activo. Una pregunta que ya tiene respuestas no cambia de redacción: desactívela y agregue otra.
        </p>
      )}

      <ErrorApi error={preguntas.error ?? error} onReintentar={preguntas.recargar} />
      {preguntas.cargando && !preguntas.data ? <Cargando /> : caracteristicas.map((c) => {
        const delGrupo = lista.filter((p) => p.caracteristica === c.numero)
        return (
          <Seccion key={c.numero}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 font-display text-headline-sm text-primary">C{c.numero}. {c.nombre}</h2>
              <span className="texto-suave">
                {delGrupo.filter((p) => p.activa).length} activa(s){c.numero === 0 && tipo === 'EE' ? ' · evalúa al estudiante: no cuenta para el docente' : ''}
              </span>
            </div>
            <div className="tabla-scroll">
              <table className="text-body-sm">
                <thead>
                  <tr>
                    <th>N.°</th><th>Pregunta</th><th>Estado</th><th className="num">Respuestas</th>
                    {editando && <th><span className="sr-only">Acciones</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {delGrupo.map((p) => (
                    <tr key={p.id_pregunta} className={p.activa ? '' : 'text-slate-400'}>
                      <td>{p.codigo}</td>
                      <td>{p.texto}{p.escala && <span className="block texto-suave">{p.escala}</span>}</td>
                      <td>{p.activa ? 'Activa' : 'Inactiva'}</td>
                      <td className="num">{p.respuestas}</td>
                      {editando && (
                        <td className="acciones whitespace-nowrap">
                          {p.respuestas === 0 && <button type="button" className="btn-enlace" onClick={() => setEditor({ pregunta: p })}>Editar</button>}
                          <button type="button" className="btn-enlace" onClick={() => accion(() => evalApi.actualizarPregunta(p.id_pregunta, { activa: !p.activa }))}>
                            {p.activa ? 'Desactivar' : 'Activar'}
                          </button>
                          {p.respuestas === 0 && <button type="button" className="btn-enlace peligro" onClick={() => eliminar(p)}>Eliminar</button>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editando && (
              <button type="button" className="btn btn-secundario self-start" onClick={() => setEditor({ caracteristica: c.numero })}>
                <Icono nombre="add" className="text-[18px]" /> Agregar pregunta a C{c.numero}
              </button>
            )}
          </Seccion>
        )
      })}

      {editor && (
        <EditorPregunta tipo={tipo} pregunta={editor.pregunta} caracteristica={editor.caracteristica} caracteristicas={caracteristicas}
          onClose={() => setEditor(null)} onGuardada={preguntas.recargar} />
      )}
    </div>
  )
}
