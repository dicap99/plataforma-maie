import NivelInsignia from '../NivelInsignia.jsx'
import { leerNota, resultadoRA } from '../rubrica'
import { clave, notasVivas, textoNota } from './comun'

// Resumen general del RA: todos los estudiantes con la nota de cada criterio, total y nivel.
// Las celdas son editables (salvo en auditoría) y comparten las ediciones con la vista por estudiante.
export default function ResumenPlanilla({ ra, niveles, estudiantes, ediciones, cambios, onNota, onVer, soloLectura }) {
  if (estudiantes.length === 0) return <div className="card"><p>Ningún estudiante coincide con el filtro.</p></div>
  return (
    <section className="tabla-scroll rounded-2xl bg-surface-container-lowest shadow-sm">
      <table className="text-body-sm">
        <thead>
          <tr>
            <th>Estudiante</th>
            {ra.criterios.map((c) => (
              <th key={c.id_criterio} className="num" title={c.nombre_criterio}>
                C{c.orden}<br /><span className="font-normal">({c.peso_porcentaje}%)</span>
              </th>
            ))}
            <th className="num">Total</th>
            <th>Nivel</th>
          </tr>
        </thead>
        <tbody>
          {estudiantes.map((e) => {
            const r = resultadoRA(niveles, ra.criterios, notasVivas(ediciones, e, ra.criterios))
            return (
              <tr key={e.id_estudiante}>
                <td className="nowrap">
                  <button type="button" className="btn-enlace font-semibold" onClick={() => onVer(e.id_estudiante)}
                    title="Abrir la rúbrica completa de este estudiante">
                    {e.apellidos} {e.nombres}
                  </button>
                  <br /><span className="text-on-surface-variant">{e.identificacion}</span>
                </td>
                {ra.criterios.map((c) => {
                  const k = clave(e.id_estudiante, c.id_criterio)
                  const valor = textoNota(ediciones, e, c)
                  const invalida = k in ediciones && leerNota(valor) === undefined
                  const cambiada = cambios.some((x) => x.id_estudiante === e.id_estudiante && x.id_criterio === c.id_criterio)
                  return (
                    <td key={c.id_criterio} className="num">
                      {soloLectura ? (valor || '—') : (
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`${e.apellidos} ${e.nombres}, criterio ${c.orden}`}
                          aria-invalid={invalida}
                          className={`w-20 rounded-lg border px-2 py-1 text-right ${
                            invalida ? 'border-error bg-error-container/40' : cambiada ? 'border-secondary bg-secondary-fixed/40' : 'border-outline-variant'
                          }`}
                          value={valor}
                          onChange={(ev) => onNota(e, c, ev.target.value)}
                        />
                      )}
                    </td>
                  )
                })}
                <td className="num font-bold text-primary">{r.total === null ? '—' : r.total.toFixed(2)}</td>
                <td><NivelInsignia nivel={r.nivel} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
