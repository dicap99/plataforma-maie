import Icono from '../../../components/common/Icono.jsx'

const NIVELES = {
  critico: { etiqueta: 'Crítico', icono: 'notifications_active', clase: 'text-error bg-error-container/60' },
  atencion: { etiqueta: 'Atención', icono: 'schedule', clase: 'text-on-secondary-fixed-variant bg-secondary-fixed' },
  info: { etiqueta: 'Al día', icono: 'task_alt', clase: 'text-on-tertiary-fixed-variant bg-tertiary-fixed' },
}

// Franja de estado sobre los indicadores: destaca lo que exige acción del coordinador.
export default function FranjaAviso({ nivel = 'info', titulo, children, acciones }) {
  const n = NIVELES[nivel] ?? NIVELES.info
  return (
    <section className="flex flex-col items-start justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-md md:flex-row md:items-center">
      <div className="flex w-full items-center gap-space-md md:w-auto">
        <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary/10 text-secondary">
          <Icono nombre={n.icono} className="text-[26px]" />
          {nivel === 'critico' && (
            <>
              <span className="absolute right-2 top-2 h-2.5 w-2.5 animate-ping rounded-full bg-error" />
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-error" />
            </>
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-label-md font-bold ${n.clase}`}>{n.etiqueta}</span>
            <h2 className="font-display text-headline-sm text-primary">{titulo}</h2>
          </div>
          <p className="text-body-sm text-on-surface-variant">{children}</p>
        </div>
      </div>
      {acciones && <div className="flex w-full items-center justify-end gap-space-sm md:w-auto">{acciones}</div>}
    </section>
  )
}
