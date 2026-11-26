import { useState } from 'react'
import * as adminApi from '../../../api/adminApi'
import useApi from '../../../hooks/useApi'
import Modal from '../../../components/common/Modal.jsx'
import { Cargando, ErrorApi } from '../../../components/common/Estado.jsx'
import Icono from '../../../components/common/Icono.jsx'
import { pesos } from '../../../utils/formato'
import { periodoAcademico } from '../../../utils/periodo'

// «Matrícula financiera» en Gestión académica › Datos del programa › Financieras (asesoría 25-nov-2026):
// permite marcar qué estudiantes de posgrado y pregrado pagaron su matrícula y el valor ingresado,
// sumando el recaudo al programa y reflejando los pagos de pregrado en Presupuesto y finanzas.
function FormularioPago({ registro, onClose, onGuardado }) {
  const [datos, setDatos] = useState({
    pagado: registro.pagado ?? true,
    valor_pagado: registro.valor_pagado ? String(registro.valor_pagado) : '',
    fecha_pago: registro.fecha_pago?.slice(0, 10) ?? '',
    referencia: registro.referencia ?? '',
    observaciones: registro.observaciones ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await adminApi.guardarMatriculaFinanciera({
        id_estudiante: registro.id_estudiante,
        poblacion: registro.poblacion,
        id_cohorte: registro.id_cohorte ?? null,
        periodo: registro.periodo,
        pagado: Boolean(datos.pagado),
        valor_pagado: datos.pagado ? Number(datos.valor_pagado || 0) : 0,
        fecha_pago: datos.fecha_pago || null,
        referencia: datos.referencia.trim() || null,
        observaciones: datos.observaciones.trim() || null,
      })
      onGuardado()
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={`Matrícula financiera · ${registro.apellidos} ${registro.nombres}`} onClose={onClose} ancho={540}>
      <form onSubmit={enviar} className="flex flex-col gap-space-sm">
        <p className="m-0 text-body-sm text-on-surface-variant">
          {registro.poblacion === 'posgrado' ? 'Posgrado' : 'Pregrado'} · Semestre {registro.periodo}
          {registro.cohorte ? ` · Promoción ${registro.cohorte}` : ''}
        </p>
        <label className="campo-check">
          <input type="checkbox" checked={datos.pagado} onChange={(e) => setDatos((d) => ({ ...d, pagado: e.target.checked }))} />
          Pagó matrícula financiera
        </label>
        <div className="form-grid">
          <div className="campo">
            <label htmlFor="mf-valor">Valor pagado (COP)</label>
            <input
              id="mf-valor"
              type="number"
              min="0"
              step="any"
              disabled={!datos.pagado}
              required={datos.pagado}
              value={datos.valor_pagado}
              onChange={(e) => setDatos((d) => ({ ...d, valor_pagado: e.target.value }))}
            />
          </div>
          <div className="campo">
            <label htmlFor="mf-fecha">Fecha de pago</label>
            <input id="mf-fecha" type="date" value={datos.fecha_pago} onChange={(e) => setDatos((d) => ({ ...d, fecha_pago: e.target.value }))} />
          </div>
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="mf-ref">Referencia / N.° de recibo (opcional)</label>
            <input id="mf-ref" maxLength={80} value={datos.referencia} onChange={(e) => setDatos((d) => ({ ...d, referencia: e.target.value }))} />
          </div>
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="mf-obs">Observaciones (opcional)</label>
            <textarea id="mf-obs" rows={2} value={datos.observaciones} onChange={(e) => setDatos((d) => ({ ...d, observaciones: e.target.value }))} />
          </div>
        </div>
        <ErrorApi error={error} />
        <div className="modal-acciones">
          <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function MatriculasFinancierasPanel({ cohortes = [] }) {
  const [periodo, setPeriodo] = useState(periodoAcademico())
  const [idCohorte, setIdCohorte] = useState('')
  const [poblacion, setPoblacion] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [exportando, setExportando] = useState(false)
  const [errorAccion, setErrorAccion] = useState(null)

  const consulta = Object.fromEntries(
    Object.entries({ periodo: periodo.trim(), id_cohorte: idCohorte, poblacion }).filter(([, v]) => v !== ''),
  )
  const api = useApi(
    () => adminApi.listarMatriculasFinancieras(consulta),
    [consulta.periodo ?? '', consulta.id_cohorte ?? '', consulta.poblacion ?? ''],
  )

  const promociones = [...cohortes].sort((a, b) => (a.periodo_inicio < b.periodo_inicio ? 1 : -1))
  const q = busqueda.trim().toLowerCase()
  const coincide = (f) => !q || `${f.apellidos} ${f.nombres} ${f.identificacion}`.toLowerCase().includes(q)
  const filas = [...(api.data?.posgrado ?? []), ...(api.data?.pregrado ?? [])].filter(coincide)
  const resumen = api.data?.resumen

  const exportar = async () => {
    setExportando(true)
    setErrorAccion(null)
    try {
      await adminApi.exportarMatriculasFinancieras(consulta)
    } catch (err) {
      setErrorAccion(err)
    } finally {
      setExportando(false)
    }
  }

  const eliminar = async (f) => {
    if (!f.id_matricula_fin || !window.confirm(`¿Eliminar el registro financiero de ${f.apellidos} ${f.nombres} (${f.periodo})?`)) return
    setErrorAccion(null)
    try {
      await adminApi.eliminarMatriculaFinanciera(f.id_matricula_fin)
      api.recargar()
    } catch (err) {
      setErrorAccion(err)
    }
  }

  return (
    <section className="flex flex-col gap-space-md">
      <div className="flex flex-wrap items-end justify-between gap-space-sm">
        <div className="flex flex-wrap items-end gap-space-sm">
          <div className="campo">
            <label htmlFor="mf-periodo">Semestre académico</label>
            <input
              id="mf-periodo"
              value={periodo}
              placeholder="Todos o AAAA-A"
              onChange={(e) => setPeriodo(e.target.value.toUpperCase())}
            />
          </div>
          <div className="campo">
            <label htmlFor="mf-cohorte">Promoción</label>
            <select id="mf-cohorte" value={idCohorte} onChange={(e) => setIdCohorte(e.target.value)}>
              <option value="">Todas</option>
              {promociones.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>Promoción {c.nombre} ({c.periodo_inicio})</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="mf-pob">Población</label>
            <select id="mf-pob" value={poblacion} onChange={(e) => setPoblacion(e.target.value)}>
              <option value="">Posgrado y pregrado</option>
              <option value="posgrado">Solo posgrado</option>
              <option value="pregrado">Solo pregrado</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="mf-buscar">Buscar</label>
            <input id="mf-buscar" type="search" placeholder="Nombre o identificación" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        </div>
        <button type="button" className="btn btn-secundario" onClick={exportar} disabled={exportando}>
          <Icono nombre="file_download" className="text-[18px]" /> {exportando ? 'Exportando…' : 'Exportar a Excel'}
        </button>
      </div>

      <p className="m-0 text-body-sm text-on-surface-variant">
        Control de pagos por semestre para estudiantes de posgrado y pregrado. Los montos marcados como pagados se suman a los
        ingresos del programa y actualizan el aporte de pregrado en Presupuesto y finanzas.
      </p>

      {resumen && (
        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-surface-container-lowest p-space-sm shadow-sm">
            <div className="text-label-sm uppercase text-on-surface-variant">Total recaudado</div>
            <div className="font-display text-headline-sm text-primary">{pesos(resumen.total_recaudado)}</div>
          </div>
          <div className="rounded-xl bg-surface-container-lowest p-space-sm shadow-sm">
            <div className="text-label-sm uppercase text-on-surface-variant">Posgrado</div>
            <div className="font-display text-headline-sm text-primary">{pesos(resumen.total_posgrado)}</div>
            <div className="text-body-sm text-on-surface-variant">{resumen.pagados_posgrado} pagados · {resumen.pendientes_posgrado} pendientes</div>
          </div>
          <div className="rounded-xl bg-surface-container-lowest p-space-sm shadow-sm">
            <div className="text-label-sm uppercase text-on-surface-variant">Pregrado</div>
            <div className="font-display text-headline-sm text-primary">{pesos(resumen.total_pregrado)}</div>
            <div className="text-body-sm text-on-surface-variant">{resumen.pagados_pregrado} pagados · {resumen.pendientes_pregrado} pendientes</div>
          </div>
          <div className="rounded-xl bg-surface-container-lowest p-space-sm shadow-sm">
            <div className="text-label-sm uppercase text-on-surface-variant">Registros visibles</div>
            <div className="font-display text-headline-sm text-primary">{filas.length}</div>
          </div>
        </div>
      )}

      <ErrorApi error={errorAccion ?? api.error} onReintentar={api.error ? api.recargar : undefined} />
      {api.cargando && !api.data ? <Cargando /> : (
        <div className="card tabla-scroll">
          <table className="text-body-sm">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Identificación</th>
                <th>Población</th>
                <th>Promoción</th>
                <th>Semestre</th>
                <th>Estado</th>
                <th className="num">Valor pagado</th>
                <th>Fecha / Recibo</th>
                <th><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={`${f.poblacion}|${f.id_estudiante}|${f.id_cohorte ?? ''}|${f.periodo}`}>
                  <td>
                    {f.apellidos} {f.nombres}
                    {f.cursos && <div className="texto-suave">{f.cursos}</div>}
                  </td>
                  <td>{f.identificacion}</td>
                  <td>{f.poblacion === 'posgrado' ? 'Posgrado' : 'Pregrado'}</td>
                  <td>{f.cohorte ? `Promoción ${f.cohorte}` : '—'}</td>
                  <td>{f.periodo}</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      f.pagado ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                    }`}>
                      {f.pagado ? 'Pagado' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="num">{f.pagado ? pesos(f.valor_pagado) : '—'}</td>
                  <td>
                    {[f.fecha_pago, f.referencia].filter(Boolean).join(' · ') || <span className="texto-suave">—</span>}
                  </td>
                  <td className="acciones whitespace-nowrap">
                    <button type="button" className="btn-enlace" onClick={() => setEditando(f)}>
                      {f.id_matricula_fin ? 'Editar' : 'Registrar pago'}
                    </button>
                    {f.id_matricula_fin && (
                      <button type="button" className="btn-enlace peligro" onClick={() => eliminar(f)}>Quitar</button>
                    )}
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={9} className="texto-suave">
                    No hay estudiantes para los filtros indicados. Indique un semestre académico (p. ej. {periodoAcademico()}) para ver todos los estudiantes pendientes por pagar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <FormularioPago
          registro={editando}
          onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); api.recargar() }}
        />
      )}
    </section>
  )
}
