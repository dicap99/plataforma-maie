// Marca visual de funcionalidades definidas en el diseño y pendientes de implementar (Actividad 3).
export default function PendienteAviso({ requisito }) {
  return (
    <p>
      <span className="pendiente">Pendiente</span>{' '}
      <span className="texto-suave">{requisito}</span>
    </p>
  )
}
