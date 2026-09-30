import Icono from '../../../components/common/Icono.jsx'

// Tarjeta de la columna derecha del panel: filete de color, rótulo con icono,
// título y contenido libre.
export default function TarjetaLateral({ rotulo, titulo, icono, tono = 'secondary', children }) {
  const filete = tono === 'secondary' ? 'bg-secondary' : 'bg-secondary-container'
  const color = tono === 'secondary' ? 'text-secondary' : 'text-secondary-container'
  return (
    <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
      <div className={`absolute bottom-0 left-0 top-0 w-1.5 ${filete}`} />
      <div className="flex items-center justify-between gap-space-sm">
        <span className="text-label-sm font-semibold uppercase text-on-surface-variant">{rotulo}</span>
        <Icono nombre={icono} className={`text-[20px] ${color}`} />
      </div>
      <h3 className="mt-1 font-display text-headline-sm text-primary">{titulo}</h3>
      {children}
    </div>
  )
}

// Par rótulo/valor dentro de una tarjeta lateral.
export function Renglon({ etiqueta, valor, destacado = false }) {
  return (
    <div className="flex items-center justify-between gap-space-sm">
      <span className="text-body-sm text-on-surface">{etiqueta}</span>
      <span className={`text-label-md font-bold ${destacado ? 'text-secondary' : 'text-primary'}`}>{valor}</span>
    </div>
  )
}
