import { useEffect } from 'react'
import { CONTACTO } from '../../config/institucional'

const MOTIVOS = {
  soporte: {
    titulo: 'Soporte',
    texto: 'Para informar sobre algún problema, puede comunicarse con la secretaría del programa.',
  },
  contrasena: {
    titulo: 'Restablecer contraseña',
    texto: 'La coordinación del programa asigna y restablece las credenciales. Escriba desde su correo institucional indicando su nombre y documento.',
  },
}

function Dato({ icono, etiqueta, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined mt-0.5 text-[20px] text-secondary">{icono}</span>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{etiqueta}</div>
        <div className="text-sm text-slate-800">{children}</div>
      </div>
    </div>
  )
}

// Recuadro con los datos de contacto de la coordinación (soporte y restablecimiento de contraseña).
export default function ContactoSoporte({ motivo, onCerrar }) {
  useEffect(() => {
    const alPresionar = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [onCerrar])

  const m = MOTIVOS[motivo] ?? MOTIVOS.soporte
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-contacto"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="titulo-contacto" className="font-display text-xl font-bold text-slate-900">{m.titulo}</h2>
            <p className="mt-1 text-sm text-slate-500">{m.texto}</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            className="text-slate-400 transition-colors hover:text-slate-600"
            onClick={onCerrar}
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="mt-5 space-y-4 rounded-lg bg-slate-50 p-4">
          <Dato icono="mail" etiqueta="Correo">
            <a className="font-medium text-secondary hover:text-indigo-800" href={`mailto:${CONTACTO.email}`}>
              {CONTACTO.email}
            </a>
          </Dato>
          <Dato icono="call" etiqueta="Teléfono">{CONTACTO.telefono}</Dato>
          <Dato icono="location_on" etiqueta="Dirección">
            {CONTACTO.direccion.map((linea) => (
              <span key={linea} className="block">{linea}</span>
            ))}
          </Dato>
        </div>
      </div>
    </div>
  )
}
