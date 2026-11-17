// Utilidades de presentación del Módulo 3 (Evaluación Docente, Acuerdo 058). Los cálculos se hacen en
// el backend (acuerdo058.js); aquí solo se formatean y se pintan.
import Icono from '../../components/common/Icono.jsx'

// Categorías del Art. 2 (verde → rojo). El color acompaña al texto, nunca lo sustituye.
export const CATEGORIAS = [
  { sigla: 'GF', nombre: 'Gran Fortaleza', rango: '80,0 – 100,0 %', color: '#1e7b34' },
  { sigla: 'F', nombre: 'Fortaleza', rango: '60,0 – 79,9 %', color: '#2a78d6' },
  { sigla: 'T', nombre: 'Transición', rango: '40,0 – 59,9 %', color: '#9a6a00' },
  { sigla: 'D', nombre: 'Debilidad', rango: '20,0 – 39,9 %', color: '#c4511c' },
  { sigla: 'GD', nombre: 'Gran Debilidad', rango: '0,0 – 19,9 %', color: '#ba1a1a' },
]
export const COLOR_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.sigla, c.color]))

export const ETIQUETA_FORMULARIO = {
  EE: 'Evaluación del estudiante (EE)',
  EC: 'Evaluación de Coordinación (EC)',
  AE: 'Autoevaluación (AE)',
}
export const ETIQUETA_POBLACION = { todas: 'Posgrado y pregrado (unidos)', posgrado: 'Solo posgrado', pregrado: 'Solo pregrado' }
export const REFERENCIA_EXCEL = 'Método del Excel de Coordinación (referencia histórica)'

const nf1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
// %IP (0–100) con un decimal.
export const ip = (v) => (v === null || v === undefined ? '—' : `${nf1.format(v)} %`)
// Proporción (0–1) como porcentaje con un decimal.
export const proporcion = (v) => (v === null || v === undefined ? '—' : `${nf1.format(v * 100)} %`)

export function CategoriaInsignia({ sigla, valor, compacta = false }) {
  if (!sigla) return <span className="text-body-sm text-on-surface-variant">Sin datos</span>
  const c = CATEGORIAS.find((x) => x.sigla === sigla)
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-label-sm font-bold"
      style={{ color: c.color, backgroundColor: `${c.color}1a` }} title={`${c.nombre} (${c.rango})`}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
      {valor !== undefined && valor !== null && <span>{ip(valor)}</span>}
      {compacta ? c.sigla : c.nombre}
    </span>
  )
}

export function Encabezado({ icono, titulo, children }) {
  return (
    <header className="flex flex-col gap-1 pb-2">
      <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
        <Icono nombre={icono} className="text-[16px]" /> Evaluación docente · Acuerdo 058 de 2022
      </div>
      <h1 className="m-0 mt-1 font-display text-headline-lg tracking-tight text-primary">{titulo}</h1>
      {children && <div className="m-0 max-w-4xl text-body-md text-on-surface-variant">{children}</div>}
    </header>
  )
}

export function Seccion({ children, className = '' }) {
  return <section className={`flex min-w-0 flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm ${className}`}>{children}</section>
}

// Leyenda de categorías del Acuerdo.
export function LeyendaCategorias() {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIAS.map((c) => (
        <span key={c.sigla} className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
          {c.nombre} ({c.sigla}) {c.rango}
        </span>
      ))}
    </div>
  )
}

// Marcas del eje de %IP (0–100) sin decimales, para que no se partan en dos líneas.
export const ejePct = (v) => `${v}`
