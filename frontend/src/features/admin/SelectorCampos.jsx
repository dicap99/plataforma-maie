import { useState } from 'react'
import Icono from '../../components/common/Icono.jsx'

// Selector de campos de formación: varios campos como fichas, buscador entre los ya registrados y
// opción de agregar uno nuevo si no está en la lista.
export default function SelectorCampos({ opciones, valor, onChange }) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const q = texto.trim().toLowerCase()
  const disponibles = opciones.filter((c) => !valor.includes(c) && (!q || c.toLowerCase().includes(q)))
  const existe = opciones.some((c) => c.toLowerCase() === q) || valor.some((c) => c.toLowerCase() === q)

  const agregar = (campo) => {
    const limpio = campo.trim()
    if (limpio && !valor.some((c) => c.toLowerCase() === limpio.toLowerCase())) onChange([...valor, limpio])
    setTexto('')
  }
  const quitar = (campo) => onChange(valor.filter((c) => c !== campo))

  return (
    <div className="campo relative">
      <label htmlFor="u-campos">Campos de formación</label>
      {valor.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
          {valor.map((c) => (
            <li key={c} className="inline-flex items-center gap-1 rounded-full bg-secondary-fixed px-2.5 py-0.5 text-label-sm font-semibold text-on-secondary-fixed-variant">
              {c}
              <button type="button" onClick={() => quitar(c)} aria-label={`Quitar ${c}`} className="grid place-items-center rounded-full hover:bg-secondary/20">
                <Icono nombre="close" className="text-[14px]" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id="u-campos"
        type="search"
        role="combobox"
        aria-expanded={abierto}
        aria-controls="u-campos-lista"
        autoComplete="off"
        placeholder="Buscar o escribir un campo…"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q) {
            e.preventDefault()
            agregar(disponibles.find((c) => c.toLowerCase() === q) ?? (disponibles.length === 1 ? disponibles[0] : texto))
          }
        }}
      />
      {abierto && (disponibles.length > 0 || (q && !existe)) && (
        <ul id="u-campos-lista" role="listbox"
          className="absolute left-0 right-0 top-full z-20 m-0 mt-1 max-h-56 list-none overflow-y-auto rounded-xl bg-surface-container-lowest p-1 shadow-lg">
          {disponibles.map((c) => (
            <li key={c} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => agregar(c)}
                className="w-full rounded-lg px-3 py-1.5 text-left text-body-md hover:bg-surface-container-low">
                {c}
              </button>
            </li>
          ))}
          {q && !existe && (
            <li role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => agregar(texto)}
                className="flex w-full items-center gap-1 rounded-lg px-3 py-1.5 text-left text-body-md text-secondary hover:bg-secondary-fixed/40">
                <Icono nombre="add" className="text-[18px]" /> Agregar «{texto.trim()}»
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
