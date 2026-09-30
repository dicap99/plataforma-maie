import { useEffect, useState } from 'react'
import * as cursosApi from '../../api/cursosApi'
import * as raApi from '../../api/raApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import { COLOR_NIVEL } from './rubrica'

const DESCRIPTORES = [
  ['Alto', 'desc_nivel_alto'],
  ['Medio', 'desc_nivel_medio'],
  ['Basico', 'desc_nivel_basico'],
  ['Insuficiente', 'desc_nivel_insuficiente'],
]
const nuevoCriterio = (orden) => ({
  orden, nombre_criterio: '', peso_porcentaje: 0,
  desc_nivel_alto: '', desc_nivel_medio: '', desc_nivel_basico: '', desc_nivel_insuficiente: '',
})
const sumaPesos = (criterios) => Math.round(criterios.reduce((s, c) => s + Math.round(Number(c.peso_porcentaje || 0) * 100), 0)) / 100

// Matriz de rúbricas (RF-RA-01): Coordinación consulta y ajusta las rúbricas institucionales de cada RA
// (Tablas 5 a 11) y ve qué cursos evalúan cada RA, con qué estrategias (Tablas 3 y 4).
export default function MatrizRubricasPage() {
  const rubricas = useApi(() => raApi.listarRubricas())
  const catalogo = useApi(cursosApi.catalogo)
  const [idRa, setIdRa] = useState(null)
  const [borrador, setBorrador] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState(null)
  const [mensaje, setMensaje] = useState(null)

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

  const { niveles } = rubricas.data
  const suma = sumaPesos(borrador)
  const modificado = JSON.stringify(borrador) !== JSON.stringify(ra.criterios)
  const completo = borrador.every((c) => c.nombre_criterio.trim() && DESCRIPTORES.every(([, k]) => c[k].trim()))

  const editar = (i, campo, valor) => setBorrador((b) => b.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)))
  const quitar = (i) => setBorrador((b) => b.filter((_, j) => j !== i).map((c, j) => ({ ...c, orden: j + 1 })))
  const agregar = () => setBorrador((b) => [...b, nuevoCriterio(b.length + 1)])

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
    <div className="flex flex-col gap-space-lg">
      <header>
        <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
          <Icono nombre="rule" className="text-[16px]" /> Resultados de aprendizaje
        </div>
        <h1 className="mt-1 font-display text-headline-lg text-primary">Matriz de rúbricas</h1>
        <p className="max-w-3xl text-body-md text-on-surface-variant">
          Rúbricas institucionales de cada RA. Los pesos de los criterios deben sumar 100 %; no se pueden quitar criterios
          que ya tienen calificaciones registradas.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
        <nav className="flex flex-row gap-2 overflow-x-auto lg:col-span-3 lg:flex-col" aria-label="Resultados de aprendizaje">
          {ras.map((r) => (
            <button
              key={r.id_ra}
              type="button"
              onClick={() => setIdRa(r.id_ra)}
              aria-current={r.id_ra === ra.id_ra}
              className={`min-w-44 rounded-xl p-space-sm text-left transition-colors ${
                r.id_ra === ra.id_ra ? 'bg-secondary text-on-secondary shadow-md' : 'bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container-low'
              }`}
            >
              <span className="font-display text-headline-sm">{r.codigo}</span>
              <span className="block text-body-sm opacity-80">{r.criterios.length} criterios · {r.suma_pesos} %</span>
            </button>
          ))}
        </nav>

        <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm lg:col-span-9">
          <div className="flex flex-col gap-space-sm md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="font-display text-headline-md text-primary">{ra.codigo}</h2>
              <p className="max-w-3xl text-body-sm text-on-surface-variant">{ra.descripcion}</p>
            </div>
            <div className="flex shrink-0 items-center gap-space-sm">
              <span
                className={`rounded-full px-3 py-1 text-label-md font-bold ${suma === 100 ? 'bg-surface-container-high text-on-primary-fixed-variant' : 'bg-error-container text-on-error-container'}`}
                role="status"
              >
                Suma de pesos: {suma} %
              </span>
              <button type="button" className="btn btn-secundario" disabled={!modificado || guardando}
                onClick={() => setBorrador(ra.criterios.map((c) => ({ ...c })))}>
                Descartar
              </button>
              <button type="button" className="btn btn-primario" disabled={!modificado || suma !== 100 || !completo || guardando} onClick={guardar}>
                {guardando ? 'Guardando…' : 'Guardar rúbrica'}
              </button>
            </div>
          </div>
          <ErrorApi error={errorGuardar} />
          {errorGuardar?.details && (
            <ul className="lista-mensajes">
              {[].concat(errorGuardar.details).map((d, i) => <li key={i}>{typeof d === 'string' ? d : d.nombre_criterio ?? d.msg}</li>)}
            </ul>
          )}
          {mensaje && <p className="texto-exito" role="status">{mensaje}</p>}

          {borrador.map((c, i) => (
            <fieldset key={c.id_criterio ?? `nuevo-${i}`} className="rounded-xl border border-outline-variant p-space-sm">
              <legend className="px-1 text-label-md font-bold text-primary">Criterio {c.orden}</legend>
              <div className="flex flex-col gap-space-sm md:flex-row">
                <label className="flex flex-1 flex-col gap-1 text-label-sm text-on-surface-variant">
                  Descripción del criterio
                  <textarea rows={2} className="rounded-lg border border-outline-variant p-2 text-body-sm text-on-surface"
                    value={c.nombre_criterio} onChange={(e) => editar(i, 'nombre_criterio', e.target.value)} />
                </label>
                <label className="flex w-28 flex-col gap-1 text-label-sm text-on-surface-variant">
                  Peso (%)
                  <input type="number" min="0" max="100" step="0.01" className="rounded-lg border border-outline-variant p-2 text-right text-body-sm text-on-surface"
                    value={c.peso_porcentaje} onChange={(e) => editar(i, 'peso_porcentaje', e.target.value)} />
                </label>
                <button type="button" className="btn-enlace peligro self-end" onClick={() => quitar(i)} disabled={borrador.length === 1}>
                  Quitar
                </button>
              </div>
              <div className="mt-space-sm grid grid-cols-1 gap-space-sm md:grid-cols-2 xl:grid-cols-4">
                {DESCRIPTORES.map(([nivel, campo]) => {
                  const n = niveles.find((x) => x.nivel === nivel)
                  return (
                    <label key={campo} className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_NIVEL[nivel] }} aria-hidden="true" />
                        {n.etiqueta} ({n.rango})
                      </span>
                      <textarea rows={3} className="rounded-lg border border-outline-variant p-2 text-body-sm text-on-surface"
                        value={c[campo]} onChange={(e) => editar(i, campo, e.target.value)} />
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ))}
          <button type="button" className="btn btn-secundario self-start" onClick={agregar}>
            <Icono nombre="add" className="text-[18px]" /> Agregar criterio
          </button>
        </section>
      </div>

      <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <h2 className="font-display text-headline-md text-primary">Momentos y estrategias de evaluación</h2>
        <p className="pb-space-md text-body-sm text-on-surface-variant">
          Cursos del plan que evalúan cada RA, con las estrategias sugeridas (E1–E6) y el nivel de dominio esperado.
        </p>
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
                  <tr key={r.id_ra} className="hover:bg-surface-container-low/50">
                    <th scope="row" className="px-3 py-2 text-left font-bold text-primary">{r.codigo}</th>
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
    </div>
  )
}
