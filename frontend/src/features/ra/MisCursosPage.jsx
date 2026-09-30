import { Link } from 'react-router-dom'
import * as cursosApi from '../../api/cursosApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import { BarraProgreso, Insignia } from '../admin/panel/TarjetaKpi.jsx'
import { porcentaje } from '../../utils/formato'

// Cursos del docente (RF-RA-02): cada oferta muestra los RA que evalúa y el avance de la calificación.
export default function MisCursosPage() {
  const { data, error, cargando, recargar } = useApi(() => cursosApi.listarOfertas())

  if (cargando && !data) return <Cargando texto="Cargando sus cursos…" />
  if (error) return <ErrorApi error={error} onReintentar={recargar} />

  const periodos = [...new Set(data.map((c) => c.periodo))]

  return (
    <div className="flex flex-col gap-space-lg">
      <header>
        <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
          <Icono nombre="fact_check" className="text-[16px]" />
          Resultados de aprendizaje
        </div>
        <h1 className="mt-1 font-display text-headline-lg text-primary">Calificar rúbricas</h1>
        <p className="text-body-md text-on-surface-variant">
          Elija un curso para registrar, por estudiante, la nota de cada criterio de la rúbrica institucional del RA
          que el curso evalúa. El total ponderado y el nivel se calculan automáticamente.
        </p>
      </header>

      {data.length === 0 && (
        <div className="card">
          <p>No tiene cursos asignados. Coordinación asigna los docentes de cada curso ofertado.</p>
        </div>
      )}

      {periodos.map((periodo) => (
        <section key={periodo} className="flex flex-col gap-space-sm">
          <h2 className="font-display text-headline-sm text-primary">Periodo {periodo}</h2>
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
            {data.filter((c) => c.periodo === periodo).map((c) => {
              const esperadas = c.inscritos * c.criterios
              const avance = esperadas ? c.notas / esperadas : 0
              return (
                <Link
                  key={c.id_curso}
                  to={String(c.id_curso)}
                  className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-space-md text-on-surface no-underline shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-label-sm font-semibold uppercase text-on-surface-variant">
                        {c.codigo} · Semestre {c.semestre}
                      </span>
                      <h3 className="font-display text-headline-sm text-primary">{c.nombre}</h3>
                      <p className="text-body-sm text-on-surface-variant">
                        Promoción {c.cohorte} · {c.inscritos} estudiante(s)
                      </p>
                    </div>
                    <Icono nombre="chevron_right" className="text-on-surface-variant" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {c.ras.map((ra) => <Insignia key={ra} tono="acento">{ra}</Insignia>)}
                    <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-bold ${
                      c.calificacion_abierta ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      <Icono nombre={c.calificacion_abierta ? 'lock_open' : 'lock'} className="text-[14px]" />
                      {c.calificacion_abierta ? 'Calificación abierta' : 'Calificación cerrada'}
                    </span>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-body-sm text-on-surface-variant">
                      <span>Notas registradas</span>
                      <span className="font-bold text-primary">{porcentaje(avance)}</span>
                    </div>
                    <BarraProgreso fraccion={avance} />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
