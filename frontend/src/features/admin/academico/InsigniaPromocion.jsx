// Paleta cromática armoniosa y distintiva por promoción/cohorte
export const PALETA_PROMOCIONES = [
  {
    // Promoción I (0) - Índigo institucional
    avatar: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    pill: 'bg-indigo-50/90 text-indigo-800 border-indigo-200/80',
    dot: 'bg-indigo-500',
  },
  {
    // Promoción II (1) - Esmeralda
    avatar: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    pill: 'bg-emerald-50/90 text-emerald-800 border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  {
    // Promoción III (2) - Azul Cielo / Sky
    avatar: 'bg-sky-100 text-sky-700 border-sky-200',
    pill: 'bg-sky-50/90 text-sky-800 border-sky-200/80',
    dot: 'bg-sky-500',
  },
  {
    // Promoción IV (3) - Ámbar / Dorado
    avatar: 'bg-amber-100 text-amber-700 border-amber-200',
    pill: 'bg-amber-50/90 text-amber-800 border-amber-200/80',
    dot: 'bg-amber-500',
  },
  {
    // Promoción V (4) - Rosa / Fucsia suave
    avatar: 'bg-rose-100 text-rose-700 border-rose-200',
    pill: 'bg-rose-50/90 text-rose-800 border-rose-200/80',
    dot: 'bg-rose-500',
  },
  {
    // Promoción VI (5) - Púrpura / Violeta
    avatar: 'bg-purple-100 text-purple-700 border-purple-200',
    pill: 'bg-purple-50/90 text-purple-800 border-purple-200/80',
    dot: 'bg-purple-500',
  },
  {
    // Promoción VII (6) - Verde Azulado / Teal
    avatar: 'bg-teal-100 text-teal-700 border-teal-200',
    pill: 'bg-teal-50/90 text-teal-800 border-teal-200/80',
    dot: 'bg-teal-500',
  },
  {
    // Promoción VIII (7) - Naranja Cálido
    avatar: 'bg-orange-100 text-orange-700 border-orange-200',
    pill: 'bg-orange-50/90 text-orange-800 border-orange-200/80',
    dot: 'bg-orange-500',
  },
]

// Extrae o calcula el número romano de una cohorte para el avatar visual
export function obtenerRomano(nombre, indice = 0) {
  if (!nombre) return 'I'
  const match = String(nombre).match(/\b([IVXLCDM]+)\b/i)
  if (match) return match[1].toUpperCase()

  const numMatch = String(nombre).match(/\b(\d+)\b/)
  if (numMatch) {
    const n = parseInt(numMatch[1], 10)
    const romanos = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
    if (romanos[n]) return romanos[n]
  }

  const romanos = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
  return romanos[indice % romanos.length] || String(indice + 1)
}

// Retorna el estilo distintivo asignado a la promoción
export function obtenerEstiloPromocion(nombre, indice = 0) {
  const romano = obtenerRomano(nombre, indice)
  const MAPA_ROMANOS = {
    I: 0,
    II: 1,
    III: 2,
    IV: 3,
    V: 4,
    VI: 5,
    VII: 6,
    VIII: 7,
    IX: 0,
    X: 1,
  }
  const idx = MAPA_ROMANOS[romano] ?? (indice % PALETA_PROMOCIONES.length)
  return {
    romano,
    ...PALETA_PROMOCIONES[idx],
  }
}

// Componente visual que renderiza la insignia distintiva de una promoción
export default function InsigniaPromocion({
  nombre,
  enProgreso = false,
  indice = 0,
  subtitulo = null,
  compacto = false,
}) {
  if (!nombre) return <span className="text-slate-300 font-normal">—</span>
  const estilo = obtenerEstiloPromocion(nombre, indice)
  const texto = String(nombre).startsWith('Sintética') ||
    String(nombre).startsWith('Cohorte') ||
    String(nombre).startsWith('Promoción')
      ? nombre
      : `Promoción ${nombre}`

  if (compacto) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border shadow-2xs ${estilo.pill}`}
        title={texto}
      >
        <span
          className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center shrink-0 border ${estilo.avatar}`}
        >
          {estilo.romano}
        </span>
        <span>{texto}</span>
      </span>
    )
  }

  return (
    <div className="inline-flex items-center space-x-2 py-0.5 font-medium">
      <span
        className={`w-6 h-6 rounded-md font-bold text-[10px] flex items-center justify-center border shrink-0 shadow-2xs ${estilo.avatar}`}
      >
        {estilo.romano}
      </span>
      <div className="flex flex-col">
        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${estilo.pill}`}>
          {texto}
        </span>
        {enProgreso && (
          <span className="text-[9px] text-amber-600 font-bold ml-1 mt-0.5">
            En curso
          </span>
        )}
        {subtitulo && (
          <span className="text-[10px] text-slate-500 font-medium ml-1">
            {subtitulo}
          </span>
        )}
      </div>
    </div>
  )
}
