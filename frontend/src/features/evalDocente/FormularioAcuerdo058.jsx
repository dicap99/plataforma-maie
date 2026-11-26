import { useEffect, useMemo, useState } from 'react'
import * as evalApi from '../../api/evalDocenteApi'
import { useAuth } from '../../context/AuthContext'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import { ETIQUETA_FORMULARIO } from './comun.jsx'

// Formulario EE, EC o AE del Acuerdo 058 (RF-EVAL-01), dividido por componente para diligenciar
// y guardar el progreso paso a paso sin sobrecargar la pantalla ni comprometer el anonimato del EE.
const TONO = { MA: '#1e7b34', A: '#2a78d6', I: '#9a6a00', MI: '#ba1a1a', NA: '#474650' }

const leerBorrador = (clave) => {
  try {
    const crudo = localStorage.getItem(clave)
    return crudo ? JSON.parse(crudo) : null
  } catch {
    return null
  }
}

const escribirBorrador = (clave, datos) => {
  try {
    localStorage.setItem(clave, JSON.stringify(datos))
  } catch { /* almacenamiento lleno o bloqueado */ }
}

const borrarBorrador = (clave) => {
  try {
    localStorage.removeItem(clave)
  } catch { /* noop */ }
}

export default function FormularioAcuerdo058({ objetivo, onEnviado, onCancelar }) {
  const { usuario } = useAuth()
  const { periodo, tipo } = objetivo
  const claveBorrador = `maie_eval_borrador:${usuario?.id ?? 'anon'}:${periodo}:${tipo}:${objetivo.id_docente}:${objetivo.id_cohorte ?? ''}`
  const instrumento = useApi(() => evalApi.formulario(tipo), [tipo])
  const [respuestas, setRespuestas] = useState(() => leerBorrador(claveBorrador)?.respuestas ?? {})
  const [comentario, setComentario] = useState(() => leerBorrador(claveBorrador)?.comentario ?? '')
  const [guardados, setGuardados] = useState(() => leerBorrador(claveBorrador)?.guardados ?? {})
  const [activaId, setActivaId] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [avisoComponente, setAvisoComponente] = useState(null)
  const [error, setError] = useState(null)
  const [faltantes, setFaltantes] = useState([])

  // EC y AE se pueden corregir mientras la evaluación está abierta: si no hay borrador local, carga lo guardado en el servidor.
  useEffect(() => {
    if (tipo === 'EE' || !objetivo.diligenciado || leerBorrador(claveBorrador)) return
    evalApi.respuestaPropia({ periodo, tipo, id_docente: objetivo.id_docente, id_cohorte: objetivo.id_cohorte })
      .then(({ data }) => {
        if (!data) return
        setRespuestas(data.items ?? {})
        setComentario(data.comentario ?? '')
        const cargados = Object.fromEntries((instrumento.data?.caracteristicas ?? []).map((c) => [`c-${c.caracteristica}`, true]))
        cargados.comentarios = true
        setGuardados(cargados)
      })
      .catch(setError)
  }, [periodo, tipo, objetivo.id_docente, objetivo.id_cohorte, objetivo.diligenciado, claveBorrador, instrumento.data])

  const secciones = useMemo(() => {
    const base = (instrumento.data?.caracteristicas ?? []).map((c) => ({
      id: `c-${c.caracteristica}`,
      corto: `C${c.caracteristica}`,
      titulo: `${c.caracteristica}. ${c.nombre}`,
      cuentaDocente: c.cuenta_docente,
      preguntas: c.preguntas,
      esComentario: false,
    }))
    return [
      ...base,
      {
        id: 'comentarios',
        corto: 'Art. 7',
        titulo: 'Opiniones, sugerencias y recomendaciones (opcional)',
        cuentaDocente: true,
        preguntas: [],
        esComentario: true,
      },
    ]
  }, [instrumento.data])

  useEffect(() => {
    if (!activaId && secciones.length) setActivaId(secciones[0].id)
  }, [activaId, secciones])

  // Mantiene el borrador sincronizado localmente ante cualquier respuesta cambiada.
  useEffect(() => {
    if (!secciones.length) return
    escribirBorrador(claveBorrador, { respuestas, comentario, guardados })
  }, [claveBorrador, respuestas, comentario, guardados, secciones.length])

  const preguntas = useMemo(() => (instrumento.data?.caracteristicas ?? []).flatMap((c) => c.preguntas), [instrumento.data])
  const respondidas = preguntas.filter((p) => respuestas[p.id_pregunta]).length
  const totalPendientes = preguntas.length - respondidas

  const estadoSeccion = (sec) => {
    if (sec.esComentario) {
      const listo = Boolean(guardados[sec.id])
      return { completas: 1, total: 1, todoRespondido: true, completado: listo }
    }
    const resp = sec.preguntas.filter((p) => Boolean(respuestas[p.id_pregunta])).length
    const todo = resp === sec.preguntas.length
    return {
      completas: resp,
      total: sec.preguntas.length,
      todoRespondido: todo,
      completado: Boolean(guardados[sec.id] && todo),
    }
  }

  const seccionActual = secciones.find((s) => s.id === activaId) ?? secciones[0]
  const indiceActual = secciones.findIndex((s) => s.id === seccionActual?.id)

  const guardarComponente = () => {
    if (!seccionActual) return
    setError(null)
    setAvisoComponente(null)
    if (!seccionActual.esComentario) {
      const faltan = seccionActual.preguntas.filter((p) => !respuestas[p.id_pregunta]).map((p) => p.id_pregunta)
      if (faltan.length) {
        setFaltantes(faltan)
        setError({ message: `Faltan ${faltan.length} pregunta(s) por responder en «${seccionActual.titulo}» (marque NA/NR si no aplica).` })
        document.getElementById(`pregunta-${faltan[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
    }
    const nuevosGuardados = { ...guardados, [seccionActual.id]: true }
    setGuardados(nuevosGuardados)
    escribirBorrador(claveBorrador, { respuestas, comentario, guardados: nuevosGuardados })
    const siguiente = secciones.slice(indiceActual + 1).find((s) => !(nuevosGuardados[s.id] && (s.esComentario || s.preguntas.every((p) => respuestas[p.id_pregunta]))))
      ?? secciones.find((s) => s.id !== seccionActual.id && !(nuevosGuardados[s.id] && (s.esComentario || s.preguntas.every((p) => respuestas[p.id_pregunta]))))
    if (siguiente) {
      setActivaId(siguiente.id)
      setAvisoComponente(`Componente «${seccionActual.corto}» guardado. Continúe con «${siguiente.corto}».`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setAvisoComponente(`Componente «${seccionActual.corto}» guardado. Ya puede enviar la evaluación completa.`)
    }
  }

  const enviar = async (e) => {
    e.preventDefault()
    setAvisoComponente(null)
    const faltan = preguntas.filter((p) => !respuestas[p.id_pregunta]).map((p) => p.id_pregunta)
    setFaltantes(faltan)
    if (faltan.length) {
      const secConFalta = secciones.find((s) => s.preguntas.some((p) => p.id_pregunta === faltan[0]))
      if (secConFalta) setActivaId(secConFalta.id)
      setError({ message: `Faltan ${faltan.length} pregunta(s) por responder (por ejemplo en ${secConFalta?.corto ?? 'el formulario'}).` })
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await evalApi.enviarRespuesta({
        periodo, tipo, id_docente: objetivo.id_docente, id_cohorte: objetivo.id_cohorte, respuestas, comentario: comentario.trim() || null,
      })
      borrarBorrador(claveBorrador)
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
              <strong>Sus respuestas son anónimas.</strong> Su avance por componente se guarda temporalmente en este navegador; la plataforma
              solo recibe el formulario completo sin su nombre. Una vez enviada no se puede modificar.
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

      {/* Navegación por componentes: verde al completar y guardar cada bloque */}
      <nav aria-label="Componentes del formulario" className="rounded-xl bg-surface-container-lowest p-space-sm shadow-sm">
        <p className="m-0 mb-2 text-label-sm font-semibold uppercase text-on-surface-variant">
          Componentes del formulario (seleccione uno para diligenciar y guardarlo)
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {secciones.map((sec) => {
            const st = estadoSeccion(sec)
            const esActual = sec.id === seccionActual?.id
            const estilo = st.completado
              ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
              : st.todoRespondido && !sec.esComentario
                ? 'border-secondary bg-secondary/10 text-secondary'
                : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant'
            return (
              <button key={sec.id} type="button"
                onClick={() => { setActivaId(sec.id); setError(null); setAvisoComponente(null) }}
                className={`flex flex-col items-start gap-0.5 rounded-xl border p-2.5 text-left transition-all ${estilo} ${esActual ? 'ring-2 ring-primary ring-offset-1' : ''}`}>
                <div className="flex w-full items-center justify-between gap-1 text-label-sm font-bold">
                  <span>{sec.corto}</span>
                  <Icono nombre={st.completado ? 'check_circle' : esActual ? 'edit_note' : 'radio_button_unchecked'} className="text-[16px]" />
                </div>
                <span className="line-clamp-2 text-body-sm font-medium leading-tight">{sec.titulo.replace(/^\d+\.\s*/, '')}</span>
                {!sec.esComentario && (
                  <span className="text-label-sm opacity-80">{st.completas}/{st.total} resp.</span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {avisoComponente && (
        <p className="m-0 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-body-sm font-medium text-emerald-900" role="status">
          <Icono nombre="check_circle" className="text-[18px] text-emerald-700" /> {avisoComponente}
        </p>
      )}

      {seccionActual && !seccionActual.esComentario && (
        <fieldset className="m-0 flex flex-col gap-3 rounded-xl border-0 bg-surface-container-lowest p-space-md shadow-sm">
          <legend className="float-left w-full p-0 font-display text-body-lg font-semibold text-primary">
            {seccionActual.titulo}
            {!seccionActual.cuentaDocente && <span className="block text-body-sm font-normal text-on-surface-variant">Sobre usted como estudiante; no entra en la calificación del docente.</span>}
          </legend>
          {seccionActual.preguntas.map((p) => (
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
                        onChange={() => {
                          setRespuestas((r) => ({ ...r, [p.id_pregunta]: v.valor }))
                          setFaltantes((prev) => prev.filter((id) => id !== p.id_pregunta))
                        }} />
                      {v.valor === 'NA' ? 'NA/NR' : v.valor}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </fieldset>
      )}

      {seccionActual?.esComentario && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
          <label htmlFor="comentario" className="font-display text-body-lg font-semibold text-primary">Opiniones, sugerencias y recomendaciones (opcional)</label>
          <p className="m-0 text-body-sm text-on-surface-variant">Para mejorar el desarrollo de los cursos e impulsar la investigación desde ellos (Acuerdo 058, Art. 7).</p>
          <textarea id="comentario" rows={4} maxLength={2000} value={comentario} onChange={(e) => setComentario(e.target.value)}
            className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-body-md" />
        </div>
      )}

      <ErrorApi error={error} />
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-container-lowest/95 p-3 shadow-md backdrop-blur">
        <span className="text-body-sm text-on-surface-variant">
          {respondidas} de {preguntas.length} respondidas{totalPendientes === 0 ? ' · formulario completo' : ''}
        </span>
        <div className="flex flex-wrap gap-2">
          {onCancelar && <button type="button" className="btn btn-secundario" onClick={onCancelar}>Volver</button>}
          {indiceActual > 0 && (
            <button type="button" className="btn btn-secundario" onClick={() => setActivaId(secciones[indiceActual - 1].id)}>Anterior</button>
          )}
          <button type="button" className="btn btn-secundario" onClick={guardarComponente}>
            <Icono nombre="save" className="text-[18px]" /> Guardar componente
          </button>
          <button type="submit" className="btn btn-primario" disabled={enviando || totalPendientes > 0}
            title={totalPendientes > 0 ? `Responda las ${totalPendientes} pregunta(s) faltantes para enviar` : undefined}>
            {enviando ? 'Enviando…' : tipo === 'EE' ? 'Enviar evaluación' : 'Guardar evaluación'}
          </button>
        </div>
      </div>
    </form>
  )
}
