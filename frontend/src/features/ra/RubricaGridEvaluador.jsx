import { useState } from 'react'
import PendienteAviso from '../../components/common/PendienteAviso.jsx'

// Niveles de la rúbrica MaIE con su rango de calificación (Documento RA MaIE).
export const NIVELES = [
  { valor: 'Alto', rango: '4.5 – 5.0' },
  { valor: 'Medio', rango: '3.5 – 4.4' },
  { valor: 'Basico', etiqueta: 'Básico', rango: '3.0 – 3.4' },
  { valor: 'Insuficiente', rango: '< 3.0' },
]

// Matriz interactiva: el docente selecciona el nivel de cada criterio por estudiante (RF-RA-02).
// estudiantes: [{ id, nombre }], criterios: [{ id_criterio, nombre_criterio, peso_porcentaje }]
export default function RubricaGridEvaluador({ estudiantes = [], criterios = [] }) {
  const [seleccion, setSeleccion] = useState({}) // clave `${estudiante}:${criterio}` → nivel

  const elegir = (est, crit, nivel) =>
    setSeleccion((prev) => ({ ...prev, [`${est}:${crit}`]: nivel }))

  return (
    <>
      <h1>Calificación por rúbrica</h1>
      <PendienteAviso requisito="RF-RA-02 — cargar criterios de /ra/rubricas y enviar a /ra/evaluaciones" />
      <div className="card tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Estudiante / Criterio</th>
              {NIVELES.map((n) => <th key={n.valor}>{n.etiqueta ?? n.valor}<br /><small>{n.rango}</small></th>)}
            </tr>
          </thead>
          <tbody>
            {estudiantes.flatMap((e) =>
              criterios.map((c) => (
                <tr key={`${e.id}:${c.id_criterio}`}>
                  <td>{e.nombre} — {c.nombre_criterio} ({c.peso_porcentaje}%)</td>
                  {NIVELES.map((n) => (
                    <td key={n.valor}>
                      <input
                        type="radio"
                        name={`${e.id}:${c.id_criterio}`}
                        aria-label={`${e.nombre} ${c.nombre_criterio} ${n.valor}`}
                        checked={seleccion[`${e.id}:${c.id_criterio}`] === n.valor}
                        onChange={() => elegir(e.id, c.id_criterio, n.valor)}
                      />
                    </td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
