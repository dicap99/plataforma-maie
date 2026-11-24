import { useState } from 'react'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import { pesos } from '../../utils/formato'
import RecursoFormulario from './RecursoFormulario.jsx'

// «Contrataciones OPS» en Gestión académica › Datos del programa › Financieras: el detalle de cada contrato
// (reunión del 20-oct-2026), armado sobre lo que ya se tiene (decisión del usuario, 2026-11-24). Por cada
// semestre con OPS reportadas en la hoja del libro se muestran los contratos registrados y, para los que faltan,
// filas en blanco listas para registrar; al final de cada semestre, el dinero reportado, y al final de la tabla,
// la suma de todo lo reportado. Mientras falten contratos, el total del semestre sigue siendo el reportado.
export default function ContratacionesOpsPanel({ recurso, cohortes }) {
  const hoja = useApi(() => adminApi.listar('contrataciones'))
  const contratos = useApi(() => adminApi.listar(recurso.id))
  const [editando, setEditando] = useState(null) // null | { fila } | { nuevo: { periodo } }
  const [errorAccion, setErrorAccion] = useState(null)

  if ((hoja.cargando && !hoja.data) || (contratos.cargando && !contratos.data)) return <Cargando />
  const error = hoja.error ?? contratos.error
  if (error) return <ErrorApi error={error} onReintentar={() => { hoja.recargar(); contratos.recargar() }} />

  const reportado = new Map((hoja.data ?? []).map((f) => [f.periodo, f]))
  const porPeriodo = new Map()
  for (const c of contratos.data ?? []) porPeriodo.set(c.periodo, [...(porPeriodo.get(c.periodo) ?? []), c])
  // Semestres con OPS reportadas o con contratos registrados (los reportados en 0 no tienen nada que detallar).
  const periodos = [...new Set([
    ...(hoja.data ?? []).filter((f) => Number(f.n_ops) > 0).map((f) => f.periodo),
    ...porPeriodo.keys(),
  ])].sort()
  const totalReportado = periodos.reduce((s, p) => s + Number(reportado.get(p)?.valor ?? 0), 0)

  const recargar = async () => { await Promise.all([hoja.recargar(), contratos.recargar()]) }
  const eliminar = async (c) => {
    if (!window.confirm(`¿Eliminar el contrato de ${c.contratista} (${c.periodo})? Esta acción no se puede deshacer.`)) return
    setErrorAccion(null)
    try {
      await adminApi.eliminar(recurso, c)
      await recargar()
    } catch (err) {
      setErrorAccion(err)
    }
  }

  const celdaVacia = <span className="text-slate-300">—</span>

  return (
    <section className="flex flex-col gap-space-md">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <p className="m-0 max-w-3xl text-body-sm text-on-surface-variant">
          Un renglón por contrato. Los renglones en blanco son contratos reportados en el libro que aún no tienen su
          detalle: use «Registrar» para completarlos. El total de cada semestre es el dinero reportado; cuando se
          registren todos sus contratos, se calcula de ellos.
        </p>
        <button type="button" className="btn btn-primario" onClick={() => setEditando({ nuevo: {} })}>
          <Icono nombre="add" className="text-[18px]" /> Agregar contrato
        </button>
      </div>
      <ErrorApi error={errorAccion} />

      <div className="card tabla-scroll">
        <table className="text-body-sm">
          <thead>
            <tr>
              <th>Semestre</th><th>Contratista</th><th>Objeto (curso o actividad)</th><th>Promoción</th>
              <th>N.° de contrato</th><th>Inicio</th><th>Terminación</th><th className="num">Valor (COP)</th>
              <th><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => {
              const registrados = porPeriodo.get(p) ?? []
              const hojaP = reportado.get(p)
              const faltan = Math.max(0, Number(hojaP?.n_ops ?? 0) - registrados.length)
              const sumaRegistrada = registrados.reduce((s, c) => s + Number(c.valor), 0)
              return [
                ...registrados.map((c) => (
                  <tr key={`c-${c.id_contrato ?? `${c.periodo}-${c.contratista}`}`}>
                    <td>{c.periodo}</td><td>{c.contratista}</td><td>{c.objeto}</td><td>{c.cohorte ?? celdaVacia}</td>
                    <td>{c.numero_contrato ?? celdaVacia}</td><td>{c.fecha_inicio?.slice(0, 10) ?? celdaVacia}</td>
                    <td>{c.fecha_fin?.slice(0, 10) ?? celdaVacia}</td><td className="num">{pesos(c.valor)}</td>
                    <td className="acciones whitespace-nowrap">
                      <button type="button" className="btn-enlace" onClick={() => setEditando({ fila: c })}>Editar</button>{' '}
                      <button type="button" className="btn-enlace" onClick={() => eliminar(c)}>Eliminar</button>
                    </td>
                  </tr>
                )),
                ...Array.from({ length: faltan }, (_, i) => (
                  <tr key={`v-${p}-${i}`} className="text-slate-400">
                    <td>{p}</td>
                    <td colSpan={6} className="italic">Contrato {registrados.length + i + 1} de {hojaP.n_ops} · por registrar</td>
                    <td className="num">{celdaVacia}</td>
                    <td className="acciones">
                      <button type="button" className="btn-enlace" onClick={() => setEditando({ nuevo: { periodo: p } })}>Registrar</button>
                    </td>
                  </tr>
                )),
                <tr key={`t-${p}`} className="bg-slate-50 font-semibold">
                  <td colSpan={7}>
                    Total {p}{hojaP ? ` · ${hojaP.n_ops} OPS reportadas` : ''}
                    {registrados.length > 0 && <span className="font-normal text-on-surface-variant"> · registrado: {pesos(sumaRegistrada)}</span>}
                  </td>
                  <td className="num">{hojaP ? pesos(hojaP.valor) : pesos(sumaRegistrada)}</td>
                  <td />
                </tr>,
              ]
            })}
            {periodos.length === 0 && <tr><td colSpan={9} className="texto-suave">No hay contrataciones OPS reportadas ni registradas.</td></tr>}
          </tbody>
          {periodos.length > 0 && (
            <tfoot>
              <tr className="font-bold">
                <td colSpan={7}>Total reportado ({periodos.length} semestres)</td>
                <td className="num">{pesos(totalReportado)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {editando && (
        <RecursoFormulario
          recurso={recurso}
          fila={editando.fila ?? null}
          cohortes={cohortes}
          valoresIniciales={editando.nuevo}
          onClose={() => setEditando(null)}
          onGuardar={async (datos) => {
            await (editando.fila ? adminApi.actualizar(recurso, editando.fila, datos) : adminApi.crear(recurso, datos))
            await recargar()
          }}
        />
      )}
    </section>
  )
}
