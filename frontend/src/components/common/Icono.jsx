// Glifo de Material Symbols Outlined (la fuente se carga en index.html).
// Decorativo por defecto: el texto adyacente es el que nombra la acción.
export default function Icono({ nombre, className = '' }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true">
      {nombre}
    </span>
  )
}
