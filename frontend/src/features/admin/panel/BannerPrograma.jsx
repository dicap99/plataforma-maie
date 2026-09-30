import Icono from '../../../components/common/Icono.jsx'

// Banner institucional del panel: identifica el programa y resume sus datos de
// cabecera. `metadatos` es la tira inferior: [{ icono, etiqueta, valor }].
export default function BannerPrograma({ descripcion, metadatos = [], children }) {
  return (
    <section className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary via-primary-container to-secondary-container p-space-lg text-on-primary shadow-xl">
      <div className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-64 w-64 rounded-full bg-tertiary-fixed/10 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-space-md lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-label-sm uppercase tracking-wider text-secondary-fixed backdrop-blur-md">
            <Icono nombre="verified" className="text-[16px]" />
            Facultad de Ingeniería · Universidad de Nariño
          </div>
          <h1 className="font-display text-headline-xl tracking-tight text-on-primary">
            Maestría en Ingeniería Electrónica
          </h1>
          <p className="max-w-3xl text-body-md text-primary-fixed-dim">{descripcion}</p>
        </div>

        {children && <div className="flex shrink-0 flex-wrap items-center gap-space-sm">{children}</div>}
      </div>

      {metadatos.length > 0 && (
        <div className="relative z-10 mt-space-lg grid grid-cols-1 gap-4 rounded-xl bg-primary/40 p-space-md backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
          {metadatos.map((m) => (
            <div key={m.etiqueta} className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10">
                <Icono nombre={m.icono} className="text-secondary-fixed" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-label-sm uppercase text-outline-variant">{m.etiqueta}</span>
                <span className="truncate text-label-md font-bold text-on-primary">{m.valor}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// Botón sobre el banner. `principal` usa el morado de acción; el resto es traslúcido.
export function BotonBanner({ icono, principal = false, children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-label-lg transition-all active:scale-95 ${
        principal
          ? 'bg-secondary text-on-secondary shadow-md hover:bg-secondary/90 hover:shadow-lg'
          : 'bg-white/10 text-on-primary shadow-sm hover:bg-white/20'
      }`}
      {...props}
    >
      <Icono nombre={icono} className="text-[18px]" />
      <span>{children}</span>
    </button>
  )
}
