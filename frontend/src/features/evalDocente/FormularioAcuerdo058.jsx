import { useEffect, useMemo, useState } from 'react'
import * as evalApi from '../../api/evalDocenteApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import { ETIQUETA_FORMULARIO } from './comun.jsx'

// Formulario EE, EC o AE del Acuerdo 058 (RF-EVAL-01), con las preguntas del instrumento institucional
// (Art. 4, 5 y 6) agrupadas por característica y la escala MA, A, I, MI, NA/NR (Art. 1). Diseñado para el
// teléfono (RNF-USA-02): una pregunta por bloque y las cinco opciones como botones táctiles.
// `objetivo` = { periodo, tipo, id_docente, docente, id_cohorte, cohorte, cursos? }.
const TONO = { MA: '#1e7b34', A: '#2a78d6', I: '#9a6a00', MI: '#ba1a1a', NA: '#474650' }

export default function FormularioAcuerdo058({ objetivo, onEnviado, onCancelar }) {
  const { periodo, tipo } = objetivo
  const instrumento = useApi(() => evalApi.formulario(tipo), [tipo])
  const [respuestas, setRespuestas] = useState({})
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [faltantes, setFaltantes] = useState([])

  // EC y AE se pueden corregir mientras la evaluación está abierta: se cargan las respuestas guardadas.
  useEffect(() => {
    if (tipo === 'EE' || !objetivo.diligenciado) return
    evalApi.respuestaPropia({ periodo, tipo, id_docente: objetivo.id_docente, id_cohorte: objetivo.id_cohorte })
      .then(({ data }) => {
        if (!data) return
        setRespuestas(data.items ?? {})
        setComentario(data.comentario ?? '')
      })
      .catch(setError)
  }, [periodo, tipo, objetivo.id_docente, objetivo.id_cohorte, objetivo.diligenciado])

  const preguntas = useMemo(() => (instrumento.data?.caracteristicas ?? []).flatMap((c) => c.preguntas), [instrumento.data])
  const respondidas = preguntas.filter((p) => respuestas[p.id_pregunta]).length

  const enviar = async (e) => {
    e.preventDefault()
    const faltan = preguntas.filter((p) => !respuestas[p.id_pregunta]).map((p) => p.id_pregunta)
    setFaltantes(faltan)
    if (faltan.length) {
      setError({ message: `Faltan ${faltan.length} pregunta(s) por responder (marque NA/NR si no aplica).` })
      document.getElementById(`pregunta-${faltan[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await evalApi.enviarRespuesta({
        periodo, tipo, id_docente: objetivo.id_docente, id_cohorte: objetivo.id_cohorte, respuestas, comentario: comentario.trim() || null,
      })
      onEnviado?.()
    } catch (err) {
      setError(err)
    } finally {
      setEnviando(false)
    }
  }

  if (instrumento.cargando) return <Cargando />
  if (instrumento.error) return <ErrorApi error={instrumento.error} onReintentar={instrumento.recargar} />
  const valores = instrumento.data.valores

  return (
    <form onSubmit={enviar} className="flex flex-col gap-space-md" noValidate>
      <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        <p className="m-0 text-label-sm font-semibold uppercase text-secondary">{ETIQUETA_FORMULARIO[tipo]} · {periodo}</p>
        <h2 className="m-0 mt-1 font-display text-headline-sm text-primary">{objetivo.docente}</h2>
        <p className="m-0 text-body-sm text-on-surface-variant">
          Promoción {objetivo.cohorte}{objetivo.cursos?.length ? ` · ${objetivo.cursos.join(', ')}` : ''}
        </p>
        {tipo === 'EE' && (
          <p className="m-0 mt-3 flex items-start gap-2 rounded-lg bg-secondary-fixed/40 p-3 text-body-sm text-on-surface">
            <Icono nombre="visibility_off" className="text-[18px] text-secondary" />
            <span>
              <strong>Sus respuestas son anónimas.</strong> La plataforma solo registra que usted ya evaluó a este docente, para que no
              responda dos veces; la respuesta se guarda sin su nombre y nadie, ni el docente ni Coordinación, puede saber qué contestó.
              Una vez enviada no se puede modificar.
            </span>
          </p>
        )}
        <dl className="m-0 mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-body-sm text-on-surface-variant sm:grid-cols-5">
          {valores.map((v) => (
            <div key={v.valor} className="flex items-center gap-1">
              <dt className="font-bold" style={{ color: TONO[v.valor] }}>{v.valor === 'NA' ? 'NA/NR' : v.valor}</dt>
              <dd className="m-0">{v.etiqueta}</dd>
            </div>
          ))}
        </dl>
      </div>

      {instrumento.data.caracteristicas.map((c) => (
        <fieldset key={c.caracteristica} className="m-0 flex flex-col gap-3 rounded-xl border-0 bg-surface-container-lowest p-space-md shadow-sm">
          <legend className="float-left w-full p-0 font-display text-body-lg font-semibold text-primary">
            {c.caracteristica}. {c.nombre}
            {!c.cuenta_docente && <span className="block text-body-sm font-normal text-on-surface-variant">Sobre usted como estudiante; no entra en la calificación del docente.</span>}
          </legend>
          {c.preguntas.map((p) => (
            <div key={p.id_pregunta} id={`pregunta-${p.id_pregunta}`}
              className={`flex flex-col gap-2 rounded-lg p-2 ${faltantes.includes(p.id_pregunta) && !respuestas[p.id_pregunta] ? 'bg-error-container/40' : ''}`}>
              <p className="m-0 text-body-md text-on-surface"><span className="font-semibold">{p.codigo}</span> {p.texto}</p>
              {p.escala && <p className="m-0 text-body-sm text-on-surface-variant">{p.escala}</p>}
              <div role="radiogroup" aria-label={`Pregunta ${p.codigo}`} className="grid grid-cols-5 gap-1.5">
                {valores.map((v) => {
                  const activo = respuestas[p.id_pregunta] === v.valor
                  return (
                    <label key={v.valor} title={v.etiqueta}
                      className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-label-lg font-bold transition-colors"
                      style={activo ? { backgroundColor: TONO[v.valor], borderColor: TONO[v.valor], color: '#fff' } : { borderColor: 'var(--color-outline-variant)', color: TONO[v.valor] }}>
                      <input type="radio" className="sr-only" name={`p-${p.id_pregunta}`} value={v.valor} checked={activo}
                        onChange={() => setRespuestas((r) => ({ ...r, [p.id_pregunta]: v.valor }))} />
                      {v.valor === 'NA' ? 'NA/NR' : v.valor}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </fieldset>
      ))}

      <div className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        <label htmlFor="comentario" className="font-display text-body-lg font-semibold text-primary">Opiniones, sugerencias y recomendaciones (opcional)</label>
        <p className="m-0 text-body-sm text-on-surface-variant">Para mejorar el desarrollo de los cursos e impulsar la investigación desde ellos (Acuerdo 058, Art. 7).</p>
        <textarea id="comentario" rows={4} maxLength={2000} value={comentario} onChange={(e) => setComentario(e.target.value)}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-body-md" />
      </div>

      <ErrorApi error={error} />
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-container-lowest/95 p-3 shadow-md backdrop-blur">
        <span className="text-body-sm text-on-surface-variant">{respondidas} de {preguntas.length} respondidas</span>
        <div className="flex gap-2">
          {onCancelar && <button type="button" className="btn btn-secundario" onClick={onCancelar}>Volver</button>}
          <button type="submit" className="btn btn-primario" disabled={enviando}>
            {enviando ? 'Enviando…' : tipo === 'EE' ? 'Enviar evaluación' : 'Guardar'}
          </button>
        </div>
      </div>
    </form>
  )
}
