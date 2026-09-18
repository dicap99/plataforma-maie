import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="pantalla-centrada">
      <div className="card">
        <h1>Página no encontrada</h1>
        <Link to="/">Volver al inicio</Link>
      </div>
    </div>
  )
}
