import { useEffect, useState } from 'react'
import * as cursosApi from '../../api/cursosApi'
import * as raApi from '../../api/raApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import Modal from '../../components/common/Modal.jsx'
import { COLOR_NIVEL } from './rubrica'

// Código SNIES del programa según la ficha técnica del PEP MaIE (Tabla 1).
const SNIES_PROGRAMA = '108095'

// Descriptor de cada nivel en la tarjeta del criterio, de mayor a menor (orden del mockup).
const DESCRIPTORES = [
  ['Alto', 'desc_nivel_alto'],
  ['Medio', 'desc_nivel_medio'],
  ['Basico', 'desc_nivel_basico'],
  ['Insuficiente', 'desc_nivel_insuficiente'],
]

const nuevoCriterio = (orden) => ({
  orden,
  nombre_criterio: '',
  peso_porcentaje: 0,
  desc_nivel_alto: '',
  desc_nivel_medio: '',
  desc_nivel_basico: '',
  desc_nivel_insuficiente: '',
})

const sumaPesos = (criterios = []) =>
  Math.round(criterios.reduce((s, c) => s + Math.round(Number(c.peso_porcentaje || 0) * 100), 0)) / 100
const formatoPct = (x) => Number(x.toFixed(2)).toString()

// Matriz de rúbricas (RF-RA-01; mockup Matriz de rúbricas): Coordinación consulta y ajusta las rúbricas
// institucionales de cada RA (documento RA MaIE, Tablas 5 a 11) y ve qué cursos del plan evalúan cada
// RA, con qué estrategias (Tablas 3 y 4).
export default function MatrizRubricasPage() {
  const rubricas = useApi(() => raApi.listarRubricas())
  const catalogo = useApi(cursosApi.catalogo)
  const [idRa, setIdRa] = useState(null)
  const [borrador, setBorrador] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [verAyudaRa, setVerAyudaRa] = useState(false)

  const ras = rubricas.data?.ras ?? []
  const ra = ras.find((r) => r.id_ra === idRa) ?? ras[0]

  useEffect(() => {
    if (ra) setBorrador(ra.criterios.map((c) => ({ ...c })))
    setErrorGuardar(null)
    setMensaje(null)
  }, [ra])

  if (rubricas.cargando && !rubricas.data) return <Cargando texto="Cargando rúbricas…" />
  if (rubricas.error) return <ErrorApi error={rubricas.error} onReintentar={rubricas.recargar} />
  if (!ra || !borrador) return null

  // Rangos de nivel desde el API (misma fuente que la planilla y los reportes).
  const nivel = (clave) => rubricas.data.niveles.find((n) => n.nivel === clave)
  const suma = sumaPesos(borrador)
  const modificado = JSON.stringify(borrador) !== JSON.stringify(ra.criterios)
  const completo = borrador.every((c) => c.nombre_criterio.trim() && DESCRIPTORES.every(([, k]) => String(c[k] ?? '').trim()))

  const editar = (i, campo, valor) => setBorrador((b) => b.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)))
  const quitar = (i) => setBorrador((b) => b.filter((_, j) => j !== i).map((c, j) => ({ ...c, orden: j + 1 })))
  const agregar = () => setBorrador((b) => [...b, nuevoCriterio(b.length + 1)])

  const cambiarRa = (nuevoId) => {
    if (nuevoId === ra.id_ra) return
    if (modificado && !window.confirm('Hay cambios sin guardar en esta rúbrica. ¿Descartarlos y cambiar de RA?')) return
    setIdRa(nuevoId)
  }

  const guardar = async () => {
    setGuardando(true)
    setErrorGuardar(null)
    setMensaje(null)
    try {
      await raApi.guardarRubrica(ra.id_ra, borrador.map((c) => ({ ...c, peso_porcentaje: Number(c.peso_porcentaje) })))
      await rubricas.recargar()
      setMensaje(`Rúbrica de ${ra.codigo} guardada.`)
    } catch (err) {
      setErrorGuardar(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-space-lg">
      <header className="flex flex-col gap-1 pb-2">
        <div className="flex items-center gap-1.5 text-label-sm font-bold uppercase tracking-wider text-secondary">
          <Icono nombre="tune" className="text-[16px]" /> Resultados de aprendizaje
        </div>
        <h1 className="font-display text-headline-lg text-primary">Matriz de rúbricas</h1>
        <p className="max-w-4xl text-body-md text-on-surface-variant">
          Rúbricas institucionales de cada RA. Los pesos de los criterios deben sumar 100 %; no se pueden quitar criterios
          que ya tienen calificaciones registradas.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
        {/* Columna izquierda: selector de RA */}
        <div className="flex flex-col gap-space-sm lg:col-span-3">
          <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
            <div className="flex items-center justify-between px-1">
              <span className="text-label-sm font-bold uppercase tracking-wider text-outline">Resultados (RA)</span>
              <span className="text-label-sm font-semibold text-secondary">{ras.length} registrados</span>
            </div>
            <nav className="flex flex-col gap-2" aria-label="Resultados de aprendizaje">
              {ras.map((r) => {
                const activo = r.id_ra === ra.id_ra
                return (
                  <button
                    key={r.id_ra}
                    type="button"
                    onClick={() => cambiarRa(r.id_ra)}
                    aria-current={activo}
                    className={`group flex w-full items-center justify-between rounded-xl p-3 text-left transition-all ${
                      activo ? 'bg-secondary text-on-secondary shadow-md' : 'bg-surface-container-low text-on-surface shadow-sm hover:bg-surface-container'
                    }`}
                  >
                    <span className="flex flex-col">
                      <span className={`font-display text-headline-sm ${activo ? '' : 'text-primary'}`}>{r.codigo}</span>
                      <span className={`text-label-sm ${activo ? 'opacity-90' : 'text-on-surface-variant'}`}>
                        {r.criterios.length} criterios · {r.suma_pesos} %
                      </span>
                    </span>
                    <Icono nombre={r.suma_pesos === 100 ? 'check_circle' : 'warning'}
                      className={`text-[20px] transition-colors ${activo ? 'text-on-secondary' : 'text-outline-variant group-hover:text-secondary'}`} />
                  </button>
                )
              })}
            </nav>
            <button type="button" onClick={() => setVerAyudaRa(true)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container px-3 py-2.5 text-label-md text-primary transition-all hover:bg-surface-container-high">
              <Icono nombre="add_circle" className="text-[18px]" /> Nuevo resultado (RA)
            </button>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-primary-container p-space-md text-on-primary shadow-sm">
            <div className="flex items-center gap-2">
              <Icono nombre="menu_book" className="text-[20px] text-secondary-fixed" />
              <span className="text-label-md font-bold">Fuente de las rúbricas</span>
            </div>
            <p className="text-body-sm text-primary-fixed-dim">
              Los {ras.length} RA y sus rúbricas provienen del documento de Resultados de Aprendizaje del PEP MaIE
              (secciones 3.2.f y 3.6.a, Tablas 5 a 11).
            </p>
          </div>
        </div>

        {/* Columna derecha: definición del RA y editor de criterios */}
        <div className="flex flex-col gap-space-lg lg:col-span-9">
          <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-primary px-2.5 py-1 font-display text-headline-sm text-on-primary">{ra.codigo}</span>
                <span className="text-label-sm font-semibold uppercase text-outline">Definición del resultado de aprendizaje</span>
              </div>
              <span className="rounded bg-surface-container-low px-2 py-0.5 text-label-sm text-on-surface-variant">
                SNIES del programa: {SNIES_PROGRAMA}
              </span>
            </div>
            <p className="rounded-xl bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface">{ra.descripcion}</p>
          </section>

          <div className="flex flex-col justify-between gap-3 rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-3">
              <span role="status"
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-label-md ${
                  suma === 100 ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-error-container text-on-error-container'}`}>
                <Icono nombre={suma === 100 ? 'check_circle' : 'warning'} className="text-[18px]" />
                Suma de pesos: <strong>{formatoPct(suma)} %</strong>
                {suma !== 100 && (
                  <span className="text-body-sm">({suma < 100 ? `faltan ${formatoPct(100 - suma)} %` : `excede ${formatoPct(suma - 100)} %`})</span>
                )}
              </span>
              {modificado && (
                <span className="flex items-center gap-1.5 text-label-sm font-semibold text-secondary">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" /> Cambios sin guardar
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-secundario" disabled={!modificado || guardando}
                onClick={() => setBorrador(ra.criterios.map((c) => ({ ...c })))}>
                Descartar
              </button>
              <button type="button" className="btn btn-primario" disabled={!modificado || suma !== 100 || !completo || guardando} onClick={guardar}>
                <Icono nombre="save" className="text-[18px]" /> {guardando ? 'Guardando…' : 'Guardar rúbrica'}
              </button>
            </div>
          </div>
          {modificado && !completo && (
            <p className="text-body-sm text-on-surface-variant">Complete la descripción y los cuatro descriptores de cada criterio para poder guardar.</p>
          )}

          <ErrorApi error={errorGuardar} />
          {errorGuardar?.details && (
            <ul className="lista-mensajes">
              {[].concat(errorGuardar.details).map((d, i) => <li key={i}>{typeof d === 'string' ? d : d.nombre_criterio ?? d.msg}</li>)}
            </ul>
          )}
          {mensaje && <p className="texto-exito" role="status">{mensaje}</p>}

          {borrador.map((c, i) => {
            const id = `crit-${ra.id_ra}-${i}`
            return (
              <article key={c.id_criterio ?? `nuevo-${i}`} className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
                <div className="flex flex-col justify-between gap-3 pb-1 md:flex-row md:items-center">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-headline-sm text-primary">Criterio {c.orden}</h2>
                    <span className="h-2 w-2 rounded-full bg-secondary" aria-hidden="true" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-1">
                      <label className="text-label-md text-on-surface-variant" htmlFor={`${id}-peso`}>Peso (%):</label>
                      <input id={`${id}-peso`} type="number" min="0" max="100" step="0.01" value={c.peso_porcentaje}
                        onChange={(e) => editar(i, 'peso_porcentaje', e.target.value)}
                        className="w-20 rounded bg-surface-container-lowest py-0.5 text-center font-display text-headline-sm text-primary shadow-sm outline-none focus:ring-2 focus:ring-secondary/40" />
                    </div>
                    <button type="button" onClick={() => quitar(i)} disabled={borrador.length === 1}
                      title={borrador.length === 1 ? 'Una rúbrica debe tener al menos un criterio' : undefined}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-label-md text-error transition-all hover:bg-error-container/20 hover:text-on-error-container disabled:opacity-40">
                      <Icono nombre="delete" className="text-[18px]" /> Quitar
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-label-sm font-semibold text-on-surface-variant" htmlFor={`${id}-nombre`}>Descripción del criterio</label>
                  <textarea id={`${id}-nombre`} rows={2} value={c.nombre_criterio} placeholder="Describa el criterio de evaluación…"
                    onChange={(e) => editar(i, 'nombre_criterio', e.target.value)}
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface shadow-sm outline-none focus:ring-2 focus:ring-secondary/30" />
                </div>

                <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2 xl:grid-cols-4">
                  {DESCRIPTORES.map(([clave, campo]) => {
                    const n = nivel(clave)
                    const color = COLOR_NIVEL[clave]
                    return (
                      <div key={campo} className="flex flex-col gap-1.5 rounded-xl bg-surface-container-low p-3 shadow-sm">
                        <label className="flex items-center gap-2 text-label-md font-bold" htmlFor={`${id}-${campo}`} style={{ color }}>
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                          {n?.etiqueta ?? clave} ({n?.rango})
                        </label>
                        <textarea id={`${id}-${campo}`} rows={4} value={c[campo] ?? ''} placeholder={`Descriptor del nivel ${(n?.etiqueta ?? clave).toLowerCase()}…`}
                          onChange={(e) => editar(i, campo, e.target.value)}
                          className="w-full resize-y rounded-lg bg-surface-container-lowest p-2 text-body-sm text-on-surface shadow-sm outline-none focus:ring-1"
                          style={{ boxShadow: `inset 0 0 0 1px ${color}40` }} />
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })}

          <button type="button" onClick={agregar}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container py-4 text-label-lg text-primary shadow-sm transition-all hover:bg-surface-container-high">
            <Icono nombre="add_circle" className="text-[24px] text-secondary" /> Agregar nuevo criterio
          </button>

          <div className="flex flex-col justify-between gap-3 rounded-xl bg-surface-container-low p-space-md shadow-sm sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Icono nombre="school" className="text-[24px] text-secondary" />
              <div className="flex flex-col">
                <span className="text-label-md font-bold text-primary">Rúbrica institucional de {ra.codigo}</span>
                <span className="text-body-sm text-on-surface-variant">
                  El total del RA es la suma ponderada de las notas de los criterios; el nivel se asigna con los rangos indicados.
                </span>
              </div>
            </div>
            <span className="text-label-sm font-semibold text-outline">Maestría en Ingeniería Electrónica · Universidad de Nariño</span>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <div>
          <h2 className="flex items-center gap-2 font-display text-headline-md text-primary">
            <Icono nombre="grid_on" className="text-[22px] text-secondary" /> Momentos y estrategias de evaluación
          </h2>
          <p className="text-body-sm text-on-surface-variant">
            Cursos del plan que evalúan cada RA, con las estrategias sugeridas (E1–E6) y el nivel de dominio esperado.
          </p>
        </div>
        {catalogo.error && <ErrorApi error={catalogo.error} onReintentar={catalogo.recargar} />}
        {catalogo.data && (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="bg-surface-container-low text-label-sm text-on-surface-variant">
                  <th className="px-3 py-2 text-left">RA</th>
                  {catalogo.data.map((k) => (
                    <th key={k.id_catalogo} className="px-2 py-2 text-center" title={k.nombre}>
                      {k.codigo.replace('MaIE-', '')}<br /><span className="font-normal">Sem. {k.semestre}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ras.map((r) => {
                  const elegido = r.id_ra === ra.id_ra
                  return (
                    <tr key={r.id_ra} className={elegido ? 'bg-secondary-fixed/30' : 'hover:bg-surface-container-low/50'}>
                      <th scope="row" className="px-3 py-2 text-left font-bold text-primary" title={r.descripcion}>{r.codigo}</th>
                      {catalogo.data.map((k) => {
                        const celda = k.ras.find((x) => x.id_ra === r.id_ra)
                        return (
                          <td key={k.id_catalogo} className="px-2 py-2 text-center"
                            title={celda ? `${k.codigo}: ${celda.nivel_dominio} · ${celda.estrategias.join(', ')}` : undefined}>
                            {celda ? (
                              <span className="inline-flex flex-col items-center">
                                <Icono nombre="check_circle" className="text-[18px] text-secondary" />
                                <span className="text-label-sm text-on-surface-variant">{celda.estrategias.join(' ')}</span>
                              </span>
                            ) : ''}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {verAyudaRa && (
        <Modal titulo="Resultados de aprendizaje del programa" onClose={() => setVerAyudaRa(false)} ancho={520}>
          <p className="text-body-md text-on-surface-variant">
            La MaIE tiene {ras.length} resultados de aprendizaje (RA1 a RA{ras.length}) definidos en su Proyecto Educativo
            del Programa (PEP, sección 3.2.f).
          </p>
          <p className="flex items-start gap-2 rounded-xl bg-surface-container-low p-3 text-body-sm text-on-surface">
            <Icono nombre="info" className="mt-0.5 shrink-0 text-[20px] text-secondary" />
            La plataforma no crea RA nuevos: un RA nuevo implica actualizar el PEP. Aquí se ajustan los criterios, pesos y
            descriptores de las rúbricas de los RA existentes.
          </p>
          <div className="modal-acciones">
            <button type="button" className="btn btn-primario" onClick={() => setVerAyudaRa(false)}>Entendido</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
