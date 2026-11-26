import { AYUDAS, BECAS, ROMANOS, SEMESTRES } from './tipos'

// Rejilla de beneficios de un estudiante en cada semestre de su promoción: una beca (o ninguna) más
// asistencias y ayudantías (con proyecto de investigación o curso(s) de ayudantía). `beneficios`: [{ semestre, tipo, detalle? }].
const ETIQUETA_DETALLE = {
  asistente_investigacion: { label: 'Proyecto de investigación', placeholder: 'Nombre o código del proyecto' },
  ayudante_docencia: { label: 'Curso(s) de ayudantía', placeholder: 'Ej. Señales (2025-B), Control (2026-A)' },
}

export default function BeneficiosPorSemestre({ beneficios, onChange, deshabilitado = false }) {
  const buscar = (s, tipo) => beneficios.find((b) => b.semestre === s && b.tipo === tipo)
  const tiene = (s, tipo) => Boolean(buscar(s, tipo))
  const sinSemestre = (s, tipos) => beneficios.filter((b) => b.semestre !== s || !tipos.includes(b.tipo))
  const cambiarBeca = (s, tipo) => onChange([...sinSemestre(s, BECAS.map((b) => b.valor)), ...(tipo ? [{ semestre: s, tipo }] : [])])
  const alternar = (s, tipo) => onChange(tiene(s, tipo) ? sinSemestre(s, [tipo]) : [...beneficios, { semestre: s, tipo, detalle: '' }])
  const cambiarDetalle = (s, tipo, detalle) =>
    onChange(beneficios.map((b) => (b.semestre === s && b.tipo === tipo ? { ...b, detalle } : b)))

  return (
    <div className="tabla-scroll">
      <table className="tabla-compacta">
        <thead>
          <tr><th>Semestre</th><th>Beca</th>{AYUDAS.map((a) => <th key={a.valor}>{a.etiqueta}</th>)}</tr>
        </thead>
        <tbody>
          {SEMESTRES.map((s) => {
            const activas = AYUDAS.filter((a) => tiene(s, a.valor))
            return [
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
              </tr>,
              activas.length > 0 && (
                <tr key={`${s}-det`} className="bg-slate-50/70">
                  <td colSpan={2 + AYUDAS.length}>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {activas.map((a) => {
                        const info = ETIQUETA_DETALLE[a.valor]
                        return (
                          <label key={a.valor} className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                            <span>{info.label} (sem. {ROMANOS[s - 1]})</span>
                            <input
                              type="text"
                              disabled={deshabilitado}
                              maxLength={500}
                              placeholder={info.placeholder}
                              value={buscar(s, a.valor)?.detalle ?? ''}
                              onChange={(e) => cambiarDetalle(s, a.valor, e.target.value)}
                            />
                          </label>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              ),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}
