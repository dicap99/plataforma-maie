import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as raApi from '../../api/raApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import NivelInsignia from './NivelInsignia.jsx'
import { COLOR_NIVEL, leerNota, resultadoRA } from './rubrica'

const clave = (idEstudiante, idCriterio) => `${idEstudiante}|${idCriterio}`
const DESCRIPTORES = [
  ['Alto', 'desc_nivel_alto'],
  ['Medio', 'desc_nivel_medio'],
  ['Basico', 'desc_nivel_basico'],
  ['Insuficiente', 'desc_nivel_insuficiente'],
]

// Planilla de calificación de una oferta (RF-RA-02). Estudiantes × criterios de la rúbrica del RA,
// con nota 0–5 por criterio; total ponderado y nivel en vivo. En modo `soloLectura` (Coordinación)
// sirve de auditoría.
export default function PlanillaRubricaPage({ soloLectura = false }) {
  const { idCurso } = useParams()
  const { data, error, cargando, recargar } = useApi(() => raApi.planilla(idCurso), [idCurso])
  const [planilla, setPlanilla] = useState(null)
  const [idRa, setIdRa] = useState(null)
  const [ediciones, setEdiciones] = useState({}) // clave → texto escrito
  const [verRubrica, setVerRubrica] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [errorGuardar, setErrorGuardar] = useState(null)

  useEffect(() => {
    if (data) setPlanilla(data)
  }, [data])

  // Celdas cambiadas respecto a lo guardado (con su valor ya interpretado).
  const cambios = useMemo(() => {
    if (!planilla) return []
    const originales = new Map(planilla.estudiantes.map((e) => [e.id_estudiante, e.notas]))
    return Object.entries(ediciones).flatMap(([k, texto]) => {
      const [idEst, idCrit] = k.split('|')
      const antes = originales.get(idEst)?.[idCrit] ?? null
      const ahora = leerNota(texto)
      return ahora === antes ? [] : [{ id_estudiante: idEst, id_criterio: Number(idCrit), calificacion: ahora }]
    })
  }, [ediciones, planilla])
  const invalidas = cambios.filter((c) => c.calificacion === undefined)
  const pendientes = cambios.length > 0

  useEffect(() => {
    if (!pendientes) return undefined
    const avisar = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [pendientes])

  if (cargando && !planilla) return <Cargando texto="Cargando planilla…" />
  if (error) return <ErrorApi error={error} onReintentar={recargar} />
  if (!planilla) return null

  const { curso, niveles, ras, estudiantes } = planilla
  const ra = ras.find((r) => r.id_ra === idRa) ?? ras[0]
  const volver = soloLectura ? '/coordinacion/ra/cursos' : '/docente/rubricas'

  const texto = (e, c) => {
    const k = clave(e.id_estudiante, c.id_criterio)
    if (k in ediciones) return ediciones[k]
    const nota = e.notas[c.id_criterio]
    return nota === undefined || nota === null ? '' : String(nota)
  }
  const notasVivas = (e) => {
    const notas = { ...e.notas }
    for (const c of ra.criterios) {
      const k = clave(e.id_estudiante, c.id_criterio)
      if (k in ediciones) notas[c.id_criterio] = leerNota(ediciones[k]) ?? undefined
    }
    return notas
  }
  const completos = estudiantes.filter((e) => resultadoRA(niveles, ra.criterios, notasVivas(e)).completo).length

  const guardar = async () => {
    setGuardando(true)
    setErrorGuardar(null)
    setMensaje(null)
    try {
      const { data: nueva } = await raApi.registrarCalificaciones(curso.id_curso, cambios)
      setPlanilla(nueva)
      setEdiciones({})
      setMensaje(`Se guardaron ${cambios.length} nota(s).`)
    } catch (err) {
      setErrorGuardar(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-sm md:flex-row md:items-end md:justify-between">
        <div>
          <Link to={volver} className="inline-flex items-center gap-1 text-label-md text-secondary no-underline">
            <Icono nombre="arrow_back" className="text-[16px]" /> {soloLectura ? 'Cursos y matrícula' : 'Mis cursos'}
          </Link>
          <h1 className="mt-1 font-display text-headline-lg text-primary">{curso.nombre}</h1>
          <p className="text-body-md text-on-surface-variant">
            {curso.codigo} · Promoción {curso.cohorte} · Periodo {curso.periodo} ·{' '}
            {curso.docentes.map((d) => d.nombre).join(', ') || 'Sin docente asignado'}
          </p>
        </div>
        {!soloLectura && (
          <div className="flex items-center gap-space-sm">
            {pendientes && <span className="text-body-sm text-on-surface-variant">{cambios.length} cambio(s) sin guardar</span>}
            <button type="button" className="btn btn-secundario" disabled={!pendientes || guardando} onClick={() => setEdiciones({})}>
              Descartar
            </button>
            <button type="button" className="btn btn-primario" disabled={!pendientes || invalidas.length > 0 || guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar notas'}
            </button>
          </div>
        )}
      </header>

      {soloLectura && (
        <p className="rounded-xl bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant">
          Vista de auditoría: las notas las registra el docente del curso.
        </p>
      )}
      {invalidas.length > 0 && (
        <div className="alerta-error" role="alert">Hay {invalidas.length} celda(s) con valores no válidos: use números de 0 a 5 con máximo dos decimales.</div>
      )}
      <ErrorApi error={errorGuardar} />
      {mensaje && <p className="texto-exito" role="status">{mensaje}</p>}

      {ras.length > 1 && (
        <div className="pestanas" role="tablist" aria-label="Resultados de aprendizaje del curso">
          {ras.map((r) => (
            <button key={r.id_ra} type="button" role="tab" aria-selected={r.id_ra === ra.id_ra}
              className={r.id_ra === ra.id_ra ? 'activa' : ''} onClick={() => setIdRa(r.id_ra)}>
              {r.codigo}
            </button>
          ))}
        </div>
      )}

      <section className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        <div className="flex flex-col gap-space-sm md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-display text-headline-sm text-primary">{ra.codigo}</h2>
            <p className="max-w-4xl text-body-sm text-on-surface-variant">{ra.descripcion}</p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Estrategias sugeridas: {ra.estrategias.join(', ')} · Nivel de dominio esperado: {ra.nivel_dominio} ·{' '}
              <strong className="text-primary">{completos} de {estudiantes.length}</strong> rúbricas completas
            </p>
          </div>
          <button type="button" className="btn btn-secundario shrink-0" onClick={() => setVerRubrica((v) => !v)} aria-expanded={verRubrica}>
            <Icono nombre={verRubrica ? 'expand_less' : 'menu_book'} className="text-[18px]" />
            {verRubrica ? 'Ocultar rúbrica' : 'Ver rúbrica'}
          </button>
        </div>

        {verRubrica && (
          <div className="tabla-scroll mt-space-md">
            <table className="text-body-sm">
              <thead>
                <tr>
                  <th>Criterio</th>
                  <th className="num">Peso</th>
                  {niveles.map((n) => <th key={n.nivel}>{n.etiqueta} ({n.rango})</th>)}
                </tr>
              </thead>
              <tbody>
                {ra.criterios.map((c) => (
                  <tr key={c.id_criterio}>
                    <td><strong>{c.orden}.</strong> {c.nombre_criterio}</td>
                    <td className="num">{c.peso_porcentaje}%</td>
                    {DESCRIPTORES.map(([nivel, campo]) => (
                      <td key={nivel} style={{ borderTop: `3px solid ${COLOR_NIVEL[nivel]}` }}>{c[campo]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {estudiantes.length === 0 ? (
        <div className="card"><p>No hay estudiantes inscritos en este curso.</p></div>
      ) : (
        <section className="tabla-scroll rounded-xl bg-surface-container-lowest shadow-sm">
          <table className="text-body-sm">
            <thead>
              <tr>
                <th>Estudiante</th>
                {ra.criterios.map((c) => (
                  <th key={c.id_criterio} className="num" title={c.nombre_criterio}>
                    Criterio {c.orden}<br /><span className="font-normal">({c.peso_porcentaje}%)</span>
                  </th>
                ))}
                <th className="num">Total</th>
                <th>Nivel</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes.map((e) => {
                const r = resultadoRA(niveles, ra.criterios, notasVivas(e))
                return (
                  <tr key={e.id_estudiante}>
                    <td className="nowrap">
                      <span className="font-semibold text-on-surface">{e.apellidos} {e.nombres}</span>
                      <br /><span className="text-on-surface-variant">{e.identificacion}</span>
                    </td>
                    {ra.criterios.map((c) => {
                      const k = clave(e.id_estudiante, c.id_criterio)
                      const valor = texto(e, c)
                      const invalida = k in ediciones && leerNota(valor) === undefined
                      const cambiada = cambios.some((x) => x.id_estudiante === e.id_estudiante && x.id_criterio === c.id_criterio)
                      return (
                        <td key={c.id_criterio} className="num">
                          {soloLectura ? (valor || '—') : (
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`${e.apellidos} ${e.nombres}, criterio ${c.orden}`}
                              aria-invalid={invalida}
                              className={`w-20 rounded-lg border px-2 py-1 text-right ${
                                invalida ? 'border-error bg-error-container/40' : cambiada ? 'border-secondary bg-secondary-fixed/40' : 'border-outline-variant'
                              }`}
                              value={valor}
                              onChange={(ev) => setEdiciones((ed) => ({ ...ed, [k]: ev.target.value }))}
                            />
                          )}
                        </td>
                      )
                    })}
                    <td className="num font-bold text-primary">{r.total === null ? '—' : r.total.toFixed(2)}</td>
                    <td><NivelInsignia nivel={r.nivel} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
