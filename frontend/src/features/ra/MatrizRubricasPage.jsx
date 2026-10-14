import { useEffect, useState } from 'react'
import * as cursosApi from '../../api/cursosApi'
import * as raApi from '../../api/raApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import Modal from '../../components/common/Modal.jsx'

// Código SNIES del programa según la ficha técnica del PEP MaIE (Tabla 1).
const SNIES_PROGRAMA = '108095'

// Niveles en el orden y con los colores del mockup (Mockups/MatrizRubrica.png): punto de color,
// color del rótulo y contorno de la caja del descriptor. Los rangos vienen del API.
const NIVELES_MOCKUP = [
  { clave: 'Alto', campo: 'desc_nivel_alto', punto: 'bg-secondary', rotulo: 'text-primary', contorno: '#e2dfff' },
  { clave: 'Medio', campo: 'desc_nivel_medio', punto: 'bg-on-tertiary-container', rotulo: 'text-primary', contorno: '#e2dfff' },
  { clave: 'Basico', campo: 'desc_nivel_basico', punto: 'bg-outline', rotulo: 'text-primary', contorno: '#e2dfff' },
  { clave: 'Insuficiente', campo: 'desc_nivel_insuficiente', punto: 'bg-error', rotulo: 'text-error', contorno: '#ffdad6' },
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
const CONTORNO = { boxShadow: 'inset 0 0 0 1px #c8c5d1' }

// Matriz de rúbricas (RF-RA-01; Mockups/MatrizRubrica.*): Coordinación consulta y ajusta las rúbricas
// institucionales de cada RA (documento RA MaIE, Tablas 5 a 11). Debajo, plegable, la correspondencia
// de cada RA con los cursos del plan y sus estrategias (Tablas 3 y 4).
export default function MatrizRubricasPage() {
  const rubricas = useApi(() => raApi.listarRubricas())
  const catalogo = useApi(cursosApi.catalogo)
  const [idRa, setIdRa] = useState(null)
  const [borrador, setBorrador] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [verAyudaRa, setVerAyudaRa] = useState(false)
  const [verMomentos, setVerMomentos] = useState(false)

  const ras = rubricas.data?.ras ?? []
  const ra = ras.find((r) => r.id_ra === idRa) ?? ras[0]

  useEffect(() => {
    if (ra) setBorrador(ra.criterios.map((c) => ({ ...c })))
    setErrorGuardar(null)
  }, [ra])

  if (rubricas.cargando && !rubricas.data) return <Cargando texto="Cargando rúbricas…" />
  if (rubricas.error) return <ErrorApi error={rubricas.error} onReintentar={rubricas.recargar} />
  if (!ra || !borrador) return null

  const rango = (clave) => rubricas.data.niveles.find((n) => n.nivel === clave)
  const suma = sumaPesos(borrador)
  const modificado = JSON.stringify(borrador) !== JSON.stringify(ra.criterios)
  const completo = borrador.every((c) => c.nombre_criterio.trim() && NIVELES_MOCKUP.every((n) => String(c[n.campo] ?? '').trim()))

  const editar = (i, campo, valor) => {
    setMensaje(null)
    setBorrador((b) => b.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)))
  }
  const quitar = (i) => setBorrador((b) => b.filter((_, j) => j !== i).map((c, j) => ({ ...c, orden: j + 1 })))
  const agregar = () => setBorrador((b) => [...b, nuevoCriterio(b.length + 1)])

  const cambiarRa = (nuevoId) => {
    if (nuevoId === ra.id_ra) return
    if (modificado && !window.confirm('Hay cambios sin guardar en esta rúbrica. ¿Descartarlos y cambiar de RA?')) return
    setMensaje(null)
    setIdRa(nuevoId)
  }

  const guardar = async () => {
    setGuardando(true)
    setErrorGuardar(null)
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
      {/* Encabezado */}
      <header className="flex flex-col gap-1 pb-2">
        <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
          <Icono nombre="tune" className="text-[16px]" /> Resultados de aprendizaje
        </div>
        <h1 className="m-0 mt-1 font-display text-headline-lg tracking-tight text-primary">Matriz de rúbricas</h1>
        <p className="m-0 max-w-4xl text-body-md text-on-surface-variant">
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
                // El RA activo refleja en vivo los criterios y la suma del borrador.
                const criterios = activo ? borrador.length : r.criterios.length
                const total = activo ? suma : r.suma_pesos
                return (
                  <button
                    key={r.id_ra}
                    type="button"
                    onClick={() => cambiarRa(r.id_ra)}
                    aria-current={activo}
                    className={`group flex w-full items-center justify-between rounded-xl border-0 p-3 text-left cursor-pointer transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
                      activo ? 'bg-secondary text-on-secondary shadow-md' : 'bg-surface-container-low text-on-surface shadow-sm hover:bg-surface-container'
                    }`}
                  >
                    <span className="flex flex-col">
                      <span className={`font-display text-headline-sm font-bold tracking-tight ${activo ? '' : 'text-primary'}`}>{r.codigo}</span>
                      <span className={`text-label-sm ${activo ? 'opacity-90' : 'text-on-surface-variant'}`}>
                        {criterios} criterios · {formatoPct(total)}%
                      </span>
                    </span>
                    <Icono
                      nombre={total === 100 ? 'check_circle' : 'error'}
                      className={`text-[20px] transition-colors ${
                        total !== 100 ? (activo ? 'text-on-secondary' : 'text-error') : activo ? 'text-on-secondary' : 'text-outline-variant group-hover:text-secondary'
                      }`}
                    />
                  </button>
                )
              })}
            </nav>
            <button type="button" onClick={() => setVerAyudaRa(true)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-0 cursor-pointer bg-surface-container px-3 py-2.5 text-label-md text-primary transition-all hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
              <Icono nombre="add_circle" className="text-[18px]" /> Nuevo resultado (RA)
            </button>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-primary-container p-space-md text-on-primary shadow-sm">
            <div className="flex items-center gap-2">
              <Icono nombre="verified" className="text-[20px] text-secondary-fixed" />
              <span className="text-label-md">Rúbricas institucionales del PEP</span>
            </div>
            <p className="m-0 text-body-sm text-primary-fixed-dim">
              Los {ras.length} RA y sus rúbricas provienen del documento de Resultados de Aprendizaje del PEP MaIE
              (secciones 3.2.f y 3.6.a).
            </p>
          </div>
        </div>

        {/* Columna derecha: definición del RA y criterios */}
        <div className="flex flex-col gap-space-lg lg:col-span-9">
          <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-primary px-2.5 py-1 font-display text-headline-sm text-on-primary">{ra.codigo}</span>
                <span className="text-label-sm font-semibold uppercase text-outline">Definición de competencia específica</span>
              </div>
              <span className="rounded bg-surface-container-low px-2 py-0.5 text-label-sm text-on-surface-variant">Código SNIES: {SNIES_PROGRAMA}</span>
            </div>
            <label className="sr-only" htmlFor={`def-${ra.id_ra}`}>Definición de {ra.codigo}</label>
            <textarea id={`def-${ra.id_ra}`} readOnly rows={2} value={ra.descripcion} title="La definición del RA proviene del PEP"
              className="w-full cursor-default resize-none rounded-xl border-0 bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface outline-none" style={CONTORNO} />
          </section>

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
                    <h2 className="m-0 font-display text-headline-sm text-primary">Criterio {c.orden}</h2>
                    <span className="h-2 w-2 rounded-full bg-secondary" aria-hidden="true" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-1">
                      <label className="text-label-md text-on-surface-variant" htmlFor={`${id}-peso`}>Peso (%):</label>
                      <input id={`${id}-peso`} type="number" min="0" max="100" step="0.01" value={c.peso_porcentaje}
                        onChange={(e) => editar(i, 'peso_porcentaje', e.target.value)}
                        className="w-20 rounded-lg border-0 bg-surface-container-lowest py-0.5 text-center font-display text-headline-sm text-primary shadow-sm outline-none [appearance:textfield] focus:ring-2 focus:ring-secondary/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                    </div>
                    <button type="button" onClick={() => quitar(i)} disabled={borrador.length === 1}
                      title={borrador.length === 1 ? 'Una rúbrica debe tener al menos un criterio' : undefined}
                      className="flex items-center gap-1 rounded-lg border-0 cursor-pointer bg-transparent px-2.5 py-1.5 text-label-md text-error transition-all hover:bg-error-container/40 hover:text-on-error-container disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
                      <Icono nombre="delete" className="text-[18px]" /> Quitar
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-label-sm font-semibold text-on-surface-variant" htmlFor={`${id}-nombre`}>Descripción del criterio</label>
                  <textarea id={`${id}-nombre`} rows={2} value={c.nombre_criterio} placeholder="Describa el criterio de evaluación…"
                    onChange={(e) => editar(i, 'nombre_criterio', e.target.value)}
                    className="w-full rounded-lg border-0 bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface shadow-sm outline-none focus:ring-2 focus:ring-secondary/30"
                    style={CONTORNO} />
                </div>

                <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2 xl:grid-cols-4">
                  {NIVELES_MOCKUP.map((n) => {
                    const r = rango(n.clave)
                    return (
                      <div key={n.campo} className="flex flex-col gap-1.5 rounded-xl bg-surface-container-low p-3 shadow-sm">
                        <label className={`flex items-center gap-2 text-label-md font-bold ${n.rotulo}`} htmlFor={`${id}-${n.campo}`}>
                          <span className={`h-2.5 w-2.5 rounded-full ${n.punto}`} aria-hidden="true" />
                          {r?.etiqueta ?? n.clave} ({r?.rango})
                        </label>
                        <textarea id={`${id}-${n.campo}`} rows={4} value={c[n.campo] ?? ''}
                          placeholder={`Descriptor nivel ${(r?.etiqueta ?? n.clave).toLowerCase()}…`}
                          onChange={(e) => editar(i, n.campo, e.target.value)}
                          className="w-full resize-none rounded-lg border-0 bg-surface-container-lowest p-2 text-body-sm text-on-surface shadow-sm outline-none focus:ring-1 focus:ring-secondary"
                          style={{ boxShadow: `inset 0 0 0 1px ${n.contorno}` }} />
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })}

          <button type="button" onClick={agregar}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-0 cursor-pointer bg-surface-container py-4 text-label-lg text-primary shadow-sm transition-all hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
            <Icono nombre="add_circle" className="text-[24px] text-secondary" /> Agregar nuevo criterio
          </button>

          <div className="flex flex-col justify-between gap-3 rounded-xl bg-surface-container-low p-space-md shadow-sm sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Icono nombre="school" className="text-[24px] text-secondary" />
              <div className="flex flex-col">
                <span className="text-label-md font-bold text-primary">Maestría en Ingeniería Electrónica · Universidad de Nariño</span>
                <span className="text-body-sm text-on-surface-variant">
                  El total del RA es la suma ponderada de las notas de los criterios; el nivel se asigna con los rangos indicados.
                </span>
              </div>
            </div>
            <button type="button" onClick={() => setVerMomentos((v) => !v)} aria-expanded={verMomentos}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border-0 cursor-pointer bg-transparent px-2 py-1 text-label-md text-secondary transition-colors hover:bg-secondary-fixed/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
              <Icono nombre={verMomentos ? 'expand_less' : 'grid_on'} className="text-[18px]" />
              {verMomentos ? 'Ocultar momentos de evaluación' : 'Ver momentos de evaluación'}
            </button>
          </div>

          {/* Barra de guardado: solo aparece con cambios pendientes */}
          {modificado && (
            <div className="sticky bottom-4 z-30 flex flex-col justify-between gap-3 rounded-xl bg-surface-container-lowest p-space-md shadow-[0_20px_28px_-6px_rgba(18,16,62,0.16)] sm:flex-row sm:items-center"
              role="region" aria-label="Cambios pendientes">
              <span className={`flex items-center gap-2 text-label-md ${suma === 100 && completo ? 'text-secondary' : 'text-error'}`} role="status">
                <Icono nombre={suma === 100 && completo ? 'check_circle' : 'warning'} className="text-[18px]" />
                Suma de pesos: {formatoPct(suma)}%
                {suma !== 100 && ` (${suma < 100 ? `faltan ${formatoPct(100 - suma)}` : `excede ${formatoPct(suma - 100)}`}%)`}
                {suma === 100 && !completo && ' · complete la descripción y los cuatro descriptores de cada criterio'}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-secundario" disabled={guardando} onClick={() => setBorrador(ra.criterios.map((c) => ({ ...c })))}>
                  Descartar
                </button>
                <button type="button" className="btn btn-primario" disabled={suma !== 100 || !completo || guardando} onClick={guardar}>
                  <Icono nombre="save" className="text-[18px]" /> {guardando ? 'Guardando…' : 'Guardar rúbrica'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {verMomentos && (
        <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <div>
            <h2 className="m-0 flex items-center gap-2 font-display text-headline-md text-primary">
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
                  {ras.map((r) => (
                    <tr key={r.id_ra} className={r.id_ra === ra.id_ra ? 'bg-secondary-fixed/30' : 'hover:bg-surface-container-low/50'}>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

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
