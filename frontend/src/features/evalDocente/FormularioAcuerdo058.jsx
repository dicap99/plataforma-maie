import { useState } from 'react'
import PendienteAviso from '../../components/common/PendienteAviso.jsx'

// Escala de valoración del Acuerdo 058.
export const ESCALA = [
  { valor: 'MA', etiqueta: 'Muy Adecuada' },
  { valor: 'A', etiqueta: 'Adecuada' },
  { valor: 'I', etiqueta: 'Inadecuada' },
  { valor: 'MI', etiqueta: 'Muy Inadecuada' },
  { valor: 'NA', etiqueta: 'No Aplica / No Responde' },
]

const TITULOS = {
  EE: 'Evaluación del Estudiante (EE)',
  AE: 'Autoevaluación Docente (AE)',
  EC: 'Evaluación de Coordinación (EC)',
}

// Encuesta digital EE / AE / EC (RF-EVAL-01). Pensada primero para móvil (RNF-USA-02).
// preguntas: [{ id_pregunta, orden, texto }]
export default function FormularioAcuerdo058({ tipo, preguntas = [] }) {
  const [respuestas, setRespuestas] = useState({})

  return (
    <>
      <h1>{TITULOS[tipo]}</h1>
      <PendienteAviso requisito={`RF-EVAL-01 — cargar /eval-docente/formularios/${tipo} y enviar a /eval-docente/respuestas`} />
      <form className="card" onSubmit={(e) => e.preventDefault()}>
        {preguntas.map((p) => (
          <fieldset key={p.id_pregunta} className="pregunta">
            <legend>{p.orden}. {p.texto}</legend>
            <div className="escala">
              {ESCALA.map((op) => (
                <label key={op.valor} className="opcion-escala">
                  <input
                    type="radio"
                    name={`p-${p.id_pregunta}`}
                    value={op.valor}
                    checked={respuestas[p.id_pregunta] === op.valor}
                    onChange={() => setRespuestas((r) => ({ ...r, [p.id_pregunta]: op.valor }))}
                  />
                  {op.etiqueta}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="campo">
          <label htmlFor="observaciones">Observaciones y sugerencias</label>
          <textarea id="observaciones" rows={3} />
        </div>
        <button className="btn btn-primario" disabled>
          Enviar evaluación
        </button>
      </form>
    </>
  )
}
