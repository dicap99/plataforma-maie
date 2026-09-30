import Icono from '../../../components/common/Icono.jsx'
import NivelInsignia from '../NivelInsignia.jsx'
import { COLOR_NIVEL, leerNota, nivelDeNota } from '../rubrica'
import { ESTADOS, NIVELES_CRITERIO, clave, estadoEstudiante, iniciales, nombreEstudiante, notasVivas, textoNota } from './comun'

function TarjetaEstudiante({ e, info, activo, onClick }) {
  const estado = ESTADOS[info.estado]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activo}
      className={`w-full rounded-xl p-space-sm text-left transition-all ${
        activo ? 'bg-surface-container-low shadow-sm ring-2 ring-secondary' : 'bg-surface-container-lowest hover:bg-surface-container-low'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-label-md font-bold ${
          activo ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-primary'}`}>
          {iniciales(e)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className={`truncate text-label-md ${activo ? 'font-bold text-primary' : 'font-semibold text-on-surface'}`}>
              {nombreEstudiante(e)}
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-label-sm font-bold ${estado.clase}`}>{estado.etiqueta}</span>
          </div>
          <span className="block text-body-sm text-on-surface-variant">Cód. {e.identificacion}</span>
          <div className="mt-1.5 flex items-center justify-between rounded-lg bg-surface-container-lowest/60 px-2 py-1">
            <span className="text-label-sm text-on-surface-variant">
              {info.completo ? 'Nota del RA' : `${info.registradas} criterio(s) con nota`}
            </span>
            {info.completo
              ? <span className="text-label-md font-bold" style={{ color: COLOR_NIVEL[info.nivel] }}>{info.total.toFixed(2)}</span>
              : <span className="text-label-sm text-outline">—</span>}
          </div>
        </div>
      </div>
    </button>
  )
}

// Tarjeta de un criterio: los cuatro niveles con su descriptor y la nota 0–5 del criterio.
// Elegir un nivel propone una nota dentro de su rango; el docente la ajusta en el campo numérico.
function Criterio({ c, e, niveles, ediciones, onNota, soloLectura }) {
  const texto = textoNota(ediciones, e, c)
  const nota = leerNota(texto)
  const invalida = nota === undefined
  const nivelActual = typeof nota === 'number' ? nivelDeNota(niveles, nota) : null
  const k = clave(e.id_estudiante, c.id_criterio)

  return (
    <article className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm md:p-space-lg">
      <div className="mb-space-md flex flex-col gap-space-sm md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary text-label-sm font-bold text-on-primary">{c.orden}</span>
          <div>
            <h3 className="font-display text-headline-sm text-primary">{c.nombre_criterio}</h3>
            <span className="mt-1 inline-block rounded-full bg-secondary-fixed px-2 py-0.5 text-label-sm font-bold text-on-secondary-fixed">
              Peso: {c.peso_porcentaje}%
            </span>
          </div>
        </div>
        <label className="flex shrink-0 flex-col items-end gap-1 text-label-sm text-outline" htmlFor={`nota-${k}`}>
          Calificación del criterio
          <span className="flex items-center gap-1">
            <input
              id={`nota-${k}`}
              type="text"
              inputMode="decimal"
              disabled={soloLectura}
              aria-invalid={invalida}
              placeholder="0 – 5"
              className={`w-20 rounded-lg border px-2 py-1 text-right font-display text-headline-sm ${
                invalida ? 'border-error bg-error-container/40 text-error' : 'border-outline-variant text-secondary'
              }`}
              value={texto}
              onChange={(ev) => onNota(e, c, ev.target.value)}
            />
            <span className="text-body-md text-on-surface-variant">/ 5.0</span>
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-space-sm md:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label={`Nivel del criterio ${c.orden}`}>
        {NIVELES_CRITERIO.map(({ nivel, campo, sugerida }) => {
          const n = niveles.find((x) => x.nivel === nivel)
          const elegido = nivelActual === nivel
          const color = COLOR_NIVEL[nivel]
          return (
            <button
              key={nivel}
              type="button"
              role="radio"
              aria-checked={elegido}
              disabled={soloLectura}
              onClick={() => !elegido && onNota(e, c, String(sugerida))}
              className={`relative flex flex-col justify-between rounded-xl p-space-sm text-left transition-all ${
                elegido ? 'shadow-sm' : 'bg-surface-container-low hover:bg-surface-container'
              } disabled:cursor-default`}
              style={elegido ? { boxShadow: `0 0 0 2px ${color}`, backgroundColor: `${color}14` } : undefined}
            >
              {elegido && <span className="absolute right-2 top-2" style={{ color }}><Icono nombre="check_circle" className="text-[20px]" /></span>}
              <div>
                <div className="mb-1 flex items-center justify-between gap-2 pr-6">
                  <span className="text-label-sm font-bold" style={{ color }}>{n.etiqueta}</span>
                  <span className="text-label-sm text-outline">{n.rango}</span>
                </div>
                <p className={`text-body-sm ${elegido ? 'font-medium text-on-surface' : 'text-on-surface-variant'}`}>{c[campo]}</p>
              </div>
              {elegido && (
                <span className="mt-2 text-label-sm font-bold" style={{ color }}>Nota asignada: {nota.toFixed(2)}</span>
              )}
            </button>
          )
        })}
      </div>
    </article>
  )
}

// Vista maestro-detalle del mockup Evaluacion_RA: lista de estudiantes y, para el elegido,
// la rúbrica completa criterio por criterio con el consolidado ponderado en vivo.
export default function EvaluacionEstudiante({
  ra, niveles, estudiantes, visibles, idEstudiante, onElegir, ediciones, onNota,
  cambiosDe, onGuardar, guardando, soloLectura,
}) {
  const e = estudiantes.find((x) => x.id_estudiante === idEstudiante) ?? visibles[0] ?? estudiantes[0]
  const posicion = visibles.findIndex((x) => x.id_estudiante === e?.id_estudiante)
  const anterior = posicion > 0 ? visibles[posicion - 1] : null
  const siguiente = posicion >= 0 && posicion < visibles.length - 1 ? visibles[posicion + 1] : null

  if (!e) return <div className="card"><p>No hay estudiantes inscritos en este curso.</p></div>

  const info = estadoEstudiante(niveles, ediciones, e, ra.criterios)
  const notas = notasVivas(ediciones, e, ra.criterios)
  const propios = cambiosDe(e.id_estudiante)
  const invalidos = propios.some((x) => x.calificacion === undefined)
  const formula = ra.criterios
    .map((c) => `(${typeof notas[c.id_criterio] === 'number' ? notas[c.id_criterio].toFixed(2) : '—'} × ${(c.peso_porcentaje / 100).toFixed(2)})`)
    .join(' + ')

  return (
    <div className="grid grid-cols-1 gap-space-lg xl:grid-cols-12">
      <aside className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md shadow-sm xl:col-span-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-headline-sm text-primary">
            <Icono nombre="group" className="text-[22px] text-secondary" /> Estudiantes
          </h2>
          <span className="text-label-sm text-on-surface-variant">{visibles.length} en la lista</span>
        </div>
        <div className="flex max-h-[900px] flex-col gap-2 overflow-y-auto pr-1">
          {visibles.map((x) => (
            <TarjetaEstudiante key={x.id_estudiante} e={x} activo={x.id_estudiante === e.id_estudiante}
              info={estadoEstudiante(niveles, ediciones, x, ra.criterios)} onClick={() => onElegir(x.id_estudiante)} />
          ))}
          {visibles.length === 0 && <p className="texto-suave">Ningún estudiante coincide con el filtro.</p>}
        </div>
      </aside>

      <main className="flex flex-col gap-space-lg xl:col-span-8">
        <div className="flex flex-col justify-between gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm md:flex-row md:items-center md:p-space-lg">
          <div className="flex items-center gap-space-md">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-secondary font-display text-headline-sm text-on-secondary shadow-md">
              {iniciales(e)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-secondary-fixed px-2.5 py-0.5 text-label-sm font-bold text-on-secondary-fixed">
                  ESTUDIANTE {posicion >= 0 ? `${posicion + 1}/${visibles.length}` : ''}
                </span>
                <span className="text-label-sm text-outline">Cód. institucional: {e.identificacion}</span>
              </div>
              <h2 className="mt-0.5 font-display text-headline-md text-primary">{nombreEstudiante(e)}</h2>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-label-sm font-bold ${ESTADOS[info.estado].clase}`}>
                {ESTADOS[info.estado].etiqueta}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-center">
            <button type="button" className="btn btn-secundario" disabled={!anterior} onClick={() => onElegir(anterior.id_estudiante)}>
              <Icono nombre="chevron_left" className="text-[18px]" /> Anterior
            </button>
            <button type="button" className="btn btn-secundario" disabled={!siguiente} onClick={() => onElegir(siguiente.id_estudiante)}>
              Siguiente <Icono nombre="chevron_right" className="text-[18px]" />
            </button>
          </div>
        </div>

        {ra.criterios.map((c) => (
          <Criterio key={c.id_criterio} c={c} e={e} niveles={niveles} ediciones={ediciones} onNota={onNota} soloLectura={soloLectura} />
        ))}

        <section className="flex flex-col gap-space-md rounded-2xl bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-space-md shadow-md md:p-space-lg">
          <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
            <div>
              <span className="text-label-sm font-bold uppercase tracking-wider text-secondary">Consolidado de evaluación {ra.codigo}</span>
              <h3 className="font-display text-headline-md text-primary">Calificación ponderada del RA</h3>
              <p className="text-body-sm text-on-surface-variant">Cálculo: {formula}</p>
            </div>
            <div className="flex items-center gap-space-md rounded-2xl bg-surface-container-lowest px-space-md py-space-sm shadow-sm">
              <div className="text-right">
                <span className="block text-label-sm text-outline">Nivel alcanzado</span>
                {info.completo ? <NivelInsignia nivel={info.nivel} /> : <span className="text-body-sm text-on-surface-variant">Faltan criterios</span>}
              </div>
              <div
                className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl text-on-secondary shadow-md"
                style={{ backgroundColor: info.completo ? COLOR_NIVEL[info.nivel] : '#787681' }}
              >
                <span className="font-display text-headline-lg leading-none">{info.completo ? info.total.toFixed(2) : '—'}</span>
                <span className="text-label-sm opacity-80">de 5.0</span>
              </div>
            </div>
          </div>
          {!soloLectura && (
            <div className="flex flex-col items-stretch justify-end gap-space-sm sm:flex-row sm:items-center">
              {invalidos && <span className="text-body-sm text-error">Corrija las notas inválidas (0 a 5, máximo dos decimales).</span>}
              {propios.length > 0 && !invalidos && <span className="text-body-sm text-on-surface-variant">{propios.length} cambio(s) sin guardar</span>}
              <button type="button" className="btn btn-secundario" disabled={!propios.length || invalidos || guardando}
                onClick={() => onGuardar(e.id_estudiante)}>
                <Icono nombre="save" className="text-[18px]" /> Guardar
              </button>
              <button type="button" className="btn btn-primario" disabled={invalidos || guardando || (!propios.length && !siguiente)}
                onClick={async () => {
                  const ok = propios.length ? await onGuardar(e.id_estudiante) : true
                  if (ok && siguiente) onElegir(siguiente.id_estudiante)
                }}>
                {guardando ? 'Guardando…' : siguiente ? 'Guardar y pasar al siguiente' : 'Guardar'}
                <Icono nombre="arrow_forward" className="text-[18px]" />
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
