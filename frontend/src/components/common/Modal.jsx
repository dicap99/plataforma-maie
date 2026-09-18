import { useEffect, useId } from 'react'

// Diálogo modal accesible: cierra con Escape o clic en el fondo.
export default function Modal({ titulo, onClose, children, ancho = 520 }) {
  const idTitulo = useId()

  useEffect(() => {
    const alPresionar = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [onClose])

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby={idTitulo} style={{ maxWidth: ancho }}>
        <h2 id={idTitulo}>{titulo}</h2>
        {children}
      </div>
    </div>
  )
}
