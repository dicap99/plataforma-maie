import { Link } from 'react-router-dom'
import Icono from '../../../components/common/Icono.jsx'
import { fecha, numero } from '../../../utils/formato'

const NIVELES = {
  critico: { etiqueta: 'Crítico', icono: 'notifications_active', clase: 'text-error bg-error-container/60' },
  atencion: { etiqueta: 'Atención', icono: 'schedule', clase: 'text-on-secondary-fixed-variant bg-secondary-fixed' },
  info: { etiqueta: 'Al día', icono: 'task_alt', clase: 'text-on-tertiary-fixed-variant bg-tertiary-fixed' },
}

const ICONO_TIPO = {
  evaluacion_docente: 'rate_review',
  titulacion: 'school',
  presupuesto: 'account_balance_wallet',
  datos: 'sync',
}

function Nivel({ nivel }) {
  const n = NIVELES[nivel] ?? NIVELES.info
  return <span className={`shrink-0 rounded-md px-2 py-0.5 text-label-md font-bold ${n.clase}`}>{n.etiqueta}</span>
}

// Renglón de plazo de titulación de una promoción.
function PlazoPromocion({ item }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-surface-container-low px-3 py-2 text-body-sm">
      <Nivel nivel={item.nivel} />
      <span className="font-bold text-primary">Promoción {item.promocion}</span>
      <span className="text-on-surface">
        {numero(item.pendientes)} sin sustentar ·{' '}
        {item.vencido ? (
          <span className="font-bold text-error">plazo vencido el {fecha(item.limite)}</span>
        ) : (
          <>
            quedan <span className="font-bold">{numero(item.meses_restantes)} meses</span> (hasta {fecha(item.limite)})
          </>
        )}
      </span>
    </li>
  )
}

function Alerta({ alerta }) {
  const critico = alerta.nivel === 'critico'
  return (
    <li className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
      <div className="flex flex-col items-start justify-between gap-space-sm md:flex-row md:items-center">
        <div className="flex items-center gap-space-md">
          <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary/10 text-secondary">
            <Icono nombre={ICONO_TIPO[alerta.tipo] ?? NIVELES[alerta.nivel]?.icono} className="text-[24px]" />
            {critico && (
              <>
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 animate-ping rounded-full bg-error" />
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-error" />
              </>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <Nivel nivel={alerta.nivel} />
              <h3 className="m-0 font-display text-headline-sm text-primary">{alerta.titulo}</h3>
            </div>
            <p className="m-0 text-body-sm text-on-surface-variant">{alerta.detalle}</p>
          </div>
        </div>
        {alerta.enlace && (
          <Link
            to={alerta.enlace.a}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-container px-3 py-2 text-label-md text-on-surface no-underline transition-colors hover:bg-surface-container-high"
          >
            {alerta.enlace.texto}
            <Icono nombre="arrow_forward" className="text-[16px]" />
          </Link>
        )}
      </div>
      {alerta.items?.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 lg:grid-cols-2">
          {alerta.items.map((item) => (
            <PlazoPromocion key={item.promocion} item={item} />
          ))}
        </ul>
      )}
    </li>
  )
}

// Alertas del coordinador calculadas en el backend (/admin/reportes/estadisticas → alertas),
// ordenadas de la más grave a la menos grave.
export default function PanelAlertas({ alertas = [] }) {
  return (
    <section aria-labelledby="titulo-alertas">
      <div className="mb-space-sm flex items-center gap-2">
        <Icono nombre="notifications" className="text-[20px] text-secondary" />
        <h2 id="titulo-alertas" className="m-0 font-display text-headline-sm text-primary">
          Alertas
        </h2>
        {alertas.length > 0 && (
          <span className="rounded-full bg-secondary-fixed px-2 text-label-sm font-bold text-on-secondary-fixed-variant">
            {numero(alertas.length)}
          </span>
        )}
      </div>
      {alertas.length === 0 ? (
        <div className="flex items-center gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
          <Nivel nivel="info" />
          <p className="m-0 text-body-sm text-on-surface-variant">
            Sin pendientes: evaluación docente, plazos de titulación, presupuesto y datos del programa al día.
          </p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-space-sm p-0">
          {alertas.map((a) => (
            <Alerta key={a.tipo} alerta={a} />
          ))}
        </ul>
      )}
    </section>
  )
}
