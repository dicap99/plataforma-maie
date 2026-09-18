// Mensajes uniformes de carga y error para vistas que consultan la API.
export function Cargando({ texto = 'Cargando…' }) {
  return <p className="texto-suave" role="status">{texto}</p>
}

export function ErrorApi({ error, onReintentar }) {
  if (!error) return null
  return (
    <div className="alerta-error" role="alert">
      <p>{error.message ?? 'Ocurrió un error'}</p>
      {onReintentar && (
        <button type="button" className="btn btn-secundario" onClick={onReintentar}>Reintentar</button>
      )}
    </div>
  )
}
