import { AYUDAS, BECAS, ROMANOS, SEMESTRES } from './tipos'

// Rejilla de beneficios de un estudiante en cada semestre de su promoción: una beca (o ninguna) más
// asistencias y ayudantías. `beneficios`: [{ semestre, tipo }].
export default function BeneficiosPorSemestre({ beneficios, onChange, deshabilitado = false }) {
  const tiene = (s, tipo) => beneficios.some((b) => b.semestre === s && b.tipo === tipo)
  const sinSemestre = (s, tipos) => beneficios.filter((b) => b.semestre !== s || !tipos.includes(b.tipo))
  const cambiarBeca = (s, tipo) => onChange([...sinSemestre(s, BECAS.map((b) => b.valor)), ...(tipo ? [{ semestre: s, tipo }] : [])])
  const alternar = (s, tipo) => onChange(tiene(s, tipo) ? sinSemestre(s, [tipo]) : [...beneficios, { semestre: s, tipo }])
  return (
    <div className="tabla-scroll">
      <table className="tabla-compacta">
        <thead>
          <tr><th>Semestre</th><th>Beca</th>{AYUDAS.map((a) => <th key={a.valor}>{a.etiqueta}</th>)}</tr>
        </thead>
        <tbody>
          {SEMESTRES.map((s) => (
            <tr key={s}>
              <td className="nowrap">Semestre {ROMANOS[s - 1]}</td>
              <td>
                <select aria-label={`Beca del semestre ${ROMANOS[s - 1]}`} disabled={deshabilitado}
                  value={BECAS.find((b) => tiene(s, b.valor))?.valor ?? ''} onChange={(e) => cambiarBeca(s, e.target.value)}>
                  <option value="">Sin beca</option>
                  {BECAS.map((b) => <option key={b.valor} value={b.valor}>{b.etiqueta}</option>)}
                </select>
              </td>
              {AYUDAS.map((a) => (
                <td key={a.valor} className="text-center">
                  <input type="checkbox" aria-label={`${a.etiqueta}, semestre ${ROMANOS[s - 1]}`} disabled={deshabilitado}
                    checked={tiene(s, a.valor)} onChange={() => alternar(s, a.valor)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
