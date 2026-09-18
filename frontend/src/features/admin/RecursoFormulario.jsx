import { useState } from 'react'
import Modal from '../../components/common/Modal.jsx'

// Formulario de alta/edición generado a partir de los campos del recurso (metadatos del API).
// En edición la llave no se modifica (identifica el registro en la URL).
export default function RecursoFormulario({ recurso, fila, cohortes, onGuardar, onClose }) {
  const editando = Boolean(fila)
  const [valores, setValores] = useState(() =>
    Object.fromEntries(recurso.campos.map((c) => [c.name, fila?.[c.name] ?? ''])),
  )
  const [errores, setErrores] = useState([])
  const [guardando, setGuardando] = useState(false)

  const cambiar = (nombre, valor) => setValores((v) => ({ ...v, [nombre]: valor }))

  const enviar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setErrores([])
    // Vacíos → null; el backend valida y convierte tipos.
    const datos = Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v === '' ? null : v]))
    try {
      await onGuardar(datos)
      onClose()
    } catch (err) {
      setErrores(err.details?.map?.((d) => d.msg) ?? [err.message])
    } finally {
      setGuardando(false)
    }
  }

  const control = (campo) => {
    const comun = {
      id: `campo-${campo.name}`,
      value: valores[campo.name] ?? '',
      required: campo.required,
      disabled: editando && recurso.llave.includes(campo.name),
      onChange: (e) => cambiar(campo.name, e.target.value),
    }
    if (campo.type === 'cohorte') {
      return (
        <select {...comun}>
          <option value="">Seleccione…</option>
          {cohortes.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>{c.nombre} ({c.periodo_inicio})</option>)}
        </select>
      )
    }
    if (campo.type === 'enum') {
      return (
        <select {...comun}>
          <option value="">Seleccione…</option>
          {campo.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    if (campo.multilinea) return <textarea rows={3} {...comun} />
    const tipos = {
      entero: { type: 'number', min: 0, step: 1 },
      semestre: { type: 'number', min: 1, max: 4, step: 1 },
      numero: { type: 'number', step: 'any' },
      dinero: { type: 'number', step: 'any' },
      fecha: { type: 'date' },
      periodo: { type: 'text', pattern: '\\d{4}-[ABab]', placeholder: 'AAAA-A' },
    }
    return <input {...(tipos[campo.type] ?? { type: 'text' })} {...comun} />
  }

  return (
    <Modal titulo={`${editando ? 'Editar' : 'Agregar'} · ${recurso.titulo}`} onClose={onClose} ancho={560}>
      <form onSubmit={enviar}>
        <div className="form-grid">
          {recurso.campos.map((campo) => (
            <div key={campo.name} className={`campo${campo.multilinea ? ' campo-ancho' : ''}`}>
              <label htmlFor={`campo-${campo.name}`}>
                {campo.label}{campo.required && ' *'}
              </label>
              {control(campo)}
            </div>
          ))}
        </div>
        {errores.length > 0 && (
          <ul className="alerta-error" role="alert">{errores.map((m) => <li key={m}>{m}</li>)}</ul>
        )}
        <div className="modal-acciones">
          <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}
