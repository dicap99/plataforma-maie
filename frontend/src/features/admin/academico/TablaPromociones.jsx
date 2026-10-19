import Icono from '../../../components/common/Icono.jsx'
import InsigniaPromocion from './InsigniaPromocion.jsx'

// Determina si una promoción está actualmente en curso (sin egresados registrados aún)
function esEnCurso(fila) {
  return typeof fila.egresados !== 'number'
}

const suma = (filas, campo) =>
  filas.reduce((acc, f) => acc + (typeof f[campo] === 'number' ? f[campo] : 0), 0)

export default function TablaPromociones({
  filas = [],
  editable = false,
  conOrigen = true,
  onEditar,
  onEliminar,
}) {
  const valor = (v) =>
    typeof v === 'number' ? (
      v
    ) : (
      <span className="text-slate-300 font-normal">—</span>
    )

  const totalInscritos = suma(filas, 'inscritos')
  const totalMatriculados = suma(filas, 'matriculados')
  const totalAprobados1 = suma(filas, 'aprobados_sem1')
  const totalAprobados2 = suma(filas, 'aprobados_sem2')
  const totalAprobados3 = suma(filas, 'aprobados_sem3')
  const totalEgresados = suma(filas, 'egresados')
  const totalGraduados = suma(filas, 'graduados')

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/90 text-slate-600 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
              <th className="py-3.5 px-4 font-bold text-slate-700" scope="col">
                Promoción
              </th>
              <th className="py-3.5 px-3 text-center" scope="col">
                Periodo Inicio
              </th>
              <th className="py-3.5 px-3 text-center" scope="col">
                Periodo Fin
              </th>
              <th className="py-3.5 px-3 text-center" scope="col">
                Inscritos Sem. I
              </th>
              <th className="py-3.5 px-3 text-center" scope="col">
                Matriculados Sem. I
              </th>
              <th className="py-3.5 px-3 text-center" scope="col">
                Aprobaron Sem. I
              </th>
              <th className="py-3.5 px-3 text-center" scope="col">
                Aprobaron Sem. II
              </th>
              <th className="py-3.5 px-3 text-center" scope="col">
                Aprobaron Sem. III
              </th>
              <th className="py-3.5 px-3 text-center" scope="col">
                Aprobaron Sem. IV{' '}
                <span className="block text-[9px] lowercase font-normal text-slate-400">
                  (egresados)
                </span>
              </th>
              <th className="py-3.5 px-4 text-center" scope="col">
                Graduados
              </th>
              {conOrigen && (
                <th className="py-3.5 px-3 text-center" scope="col">
                  Origen
                </th>
              )}
              {editable && (
                <th className="py-3.5 px-4 text-right" scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filas.length === 0 ? (
              <tr>
                <td
                  colSpan={conOrigen ? (editable ? 12 : 11) : editable ? 11 : 10}
                  className="py-6 text-center text-slate-400 italic"
                >
                  No hay promociones registradas para mostrar.
                </td>
              </tr>
            ) : (
              filas.map((fila, i) => {
                const enProgreso = esEnCurso(fila)
                const baseGraduacion = fila.egresados || fila.matriculados || 1
                const pctGrad =
                  typeof fila.graduados === 'number' && fila.graduados > 0
                    ? Math.round((fila.graduados / baseGraduacion) * 100)
                    : 0

                return (
                  <tr
                    key={fila.id_cohorte ?? fila.nombre ?? i}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <InsigniaPromocion nombre={fila.nombre} enProgreso={enProgreso} indice={i} />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                        {fila.periodo_inicio || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                        {fila.periodo_fin || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-medium tabular-numbers">
                      {valor(fila.inscritos)}
                    </td>
                    <td className="py-3 px-3 text-center font-medium tabular-numbers">
                      {valor(fila.matriculados)}
                    </td>
                    <td className="py-3 px-3 text-center font-medium tabular-numbers">
                      {valor(fila.aprobados_sem1)}
                    </td>
                    <td className="py-3 px-3 text-center font-medium tabular-numbers">
                      {valor(fila.aprobados_sem2)}
                    </td>
                    <td className="py-3 px-3 text-center font-medium tabular-numbers">
                      {valor(fila.aprobados_sem3)}
                    </td>
                    <td className="py-3 px-3 text-center font-medium tabular-numbers text-slate-900 font-semibold">
                      {valor(fila.egresados)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {typeof fila.graduados === 'number' && fila.graduados > 0 ? (
                        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold tabular-numbers">
                          <Icono nombre="school" className="text-[12px] text-emerald-600" />
                          <span>{fila.graduados}</span>
                          <span className="text-[10px] text-emerald-600/80 font-normal">
                            ({pctGrad}%)
                          </span>
                        </div>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium tabular-numbers text-[11px]">
                          0
                        </span>
                      )}
                    </td>
                    {conOrigen && (
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            fila.origen === 'gestion'
                              ? 'bg-violet-50 text-violet-700 border-violet-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {fila.origen === 'gestion' ? 'Gestión' : 'Registro'}
                        </span>
                      </td>
                    )}
                    {editable && (
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          className="btn-enlace text-xs"
                          onClick={() => onEditar?.(fila)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-enlace peligro text-xs"
                          onClick={() => onEliminar?.(fila)}
                        >
                          Eliminar
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr className="bg-indigo-50/50 font-bold text-slate-800 border-t-2 border-indigo-100">
                <td className="py-3 px-4 uppercase text-[11px] text-indigo-950 tracking-wider">
                  Total / Consolidado
                </td>
                <td
                  className="py-3 px-3 text-center text-slate-400 font-normal text-[11px]"
                  colSpan={2}
                >
                  {filas.length} Cohortes
                </td>
                <td className="py-3 px-3 text-center font-bold text-slate-900 tabular-numbers">
                  {totalInscritos}
                </td>
                <td className="py-3 px-3 text-center font-bold text-slate-900 tabular-numbers">
                  {totalMatriculados}
                </td>
                <td className="py-3 px-3 text-center font-bold text-slate-900 tabular-numbers">
                  {totalAprobados1}
                </td>
                <td className="py-3 px-3 text-center font-bold text-slate-900 tabular-numbers">
                  {totalAprobados2}
                </td>
                <td className="py-3 px-3 text-center font-bold text-slate-900 tabular-numbers">
                  {totalAprobados3}
                </td>
                <td className="py-3 px-3 text-center font-bold text-slate-900 tabular-numbers">
                  {totalEgresados}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold tabular-numbers">
                    {totalGraduados}
                  </span>
                </td>
                {conOrigen && (
                  <td className="py-3 px-3 text-center text-[11px] text-slate-400">
                    Total
                  </td>
                )}
                {editable && <td className="py-3 px-4"></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
