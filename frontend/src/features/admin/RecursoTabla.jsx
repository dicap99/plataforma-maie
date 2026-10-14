import { useState } from 'react'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import { valorCampo } from '../../utils/formato'
import RecursoFormulario from './RecursoFormulario.jsx'

// Tabla editable de un recurso del Módulo 1 (una hoja de "Estadísticas MaIE").
// `filtro` = { etiqueta, fn } limita las filas visibles (p. ej. al hacer clic en una gráfica).
// `soloLectura`: sin agregar, editar ni eliminar. `filasExternas`: filas ya calculadas (p. ej. el reflejo
// de Gestión académica) en lugar de las de la hoja; si traen `origen`, se muestra de dónde sale cada fila.
export default function RecursoTabla({ recurso, cohortes, onCambio, filtro, onQuitarFiltro, soloLectura = false, filasExternas }) {
  const api = useApi(() => (filasExternas ? Promise.resolve({ data: null }) : adminApi.listar(recurso.id)), [recurso.id, Boolean(filasExternas)])
  const filas = filasExternas ?? api.data
  const { error, cargando, recargar } = api
  const editable = recurso.editable && !soloLectura
  const conOrigen = (filas ?? []).some((f) => f.origen)
  const [editando, setEditando] = useState(null) // null | 'nuevo' | fila
  const [viendoDetalles, setViendoDetalles] = useState(null) // fila
  const [viendoTodosDetalles, setViendoTodosDetalles] = useState(false)
  const [errorAccion, setErrorAccion] = useState(null)

  const tras = async (promesa) => {
    await promesa
    await recargar()
    onCambio?.()
  }

  const eliminar = async (fila) => {
    const nombre = fila.cohorte ?? fila.nombre ?? fila.nombre_completo ?? fila.periodo ?? fila.clave
    if (!window.confirm(`¿Eliminar el registro "${nombre}"? Esta acción no se puede deshacer.`)) return
    setErrorAccion(null)
    try {
      await tras(adminApi.eliminar(recurso, fila))
    } catch (err) {
      setErrorAccion(err)
    }
  }

  const visibles = filas ? (filtro ? filas.filter(filtro.fn) : filas) : []
  const columnas = recurso.campos.filter((c) => !c.multilinea || c.mostrarEnTabla)
  const celda = (campo, fila) => (campo.type === 'cohorte' ? fila.cohorte : valorCampo(campo, fila[campo.name]))

  const tieneDetalles = recurso.id === 'produccion' || recurso.campos.some(c => c.name === 'detalles' && c.multilinea)
  const tieneAcciones = editable || tieneDetalles

  if (viendoTodosDetalles) {
    return (
      <section className="animate-fade-in">
        <header className="barra-herramientas mb-4">
          <div className="flex items-center gap-4">
            <button type="button" className="btn btn-secundario" onClick={() => setViendoTodosDetalles(false)}>
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Volver a la tabla
            </button>
            <h2 className="text-xl font-bold text-slate-800">
              Reporte General: Detalles de {recurso.titulo}
            </h2>
          </div>
        </header>
        <div className="grid gap-6">
          {visibles.map(fila => (
            <div key={fila.id_cohorte} className="card p-6 bg-white shadow-sm border border-slate-200 rounded-xl">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3 border-b pb-2">
                Promoción {fila.cohorte}
              </h3>
              {fila.detalles ? (
                <div className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  {fila.detalles}
                </div>
              ) : (
                <p className="text-slate-500 italic">No hay detalles registrados.</p>
              )}
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (viendoDetalles) {
    return (
      <section className="animate-fade-in">
        <header className="barra-herramientas mb-4">
          <div className="flex items-center gap-4">
            <button type="button" className="btn btn-secundario" onClick={() => setViendoDetalles(null)}>
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Volver
            </button>
            <h2 className="text-xl font-bold text-slate-800">
              Detalles de Producción - Promoción {viendoDetalles.cohorte}
            </h2>
          </div>
        </header>
        <div className="card p-6 bg-white shadow-sm border border-slate-200 rounded-xl">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Lista de Productos</h3>
          {viendoDetalles.detalles ? (
            <div className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100">
              {viendoDetalles.detalles}
            </div>
          ) : (
            <p className="text-slate-500 italic">No hay detalles registrados para esta promoción.</p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section>
      <header className="barra-herramientas">
        <div className="flex items-center gap-4">
          <p className="texto-suave">
            {recurso.requisito} · Hoja «{recurso.hoja}» ·{' '}
            {filtro && filas ? `${visibles.length} de ${filas.length}` : filas?.length ?? 0} registro(s)
          </p>
          {filtro && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary-fixed px-3 py-1 text-label-sm font-semibold text-on-secondary-fixed-variant">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">filter_alt</span>
              {filtro.etiqueta}
              <button type="button" className="ml-1 grid place-items-center rounded-full hover:bg-secondary/20" onClick={onQuitarFiltro} aria-label="Quitar filtro">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
              </button>
            </span>
          )}
          {tieneDetalles && filas?.length > 0 && (
            <button type="button" className="btn-enlace text-indigo-600 text-sm font-medium ml-4" onClick={() => setViendoTodosDetalles(true)}>
              <span className="material-symbols-outlined text-[16px] mr-1 align-text-bottom">visibility</span>
              Ver todos los detalles
            </button>
          )}
        </div>
        {editable && (
          <button type="button" className="btn btn-primario" onClick={() => setEditando('nuevo')}>Agregar</button>
        )}
      </header>

      <ErrorApi error={error} onReintentar={recargar} />
      <ErrorApi error={errorAccion} />
      {cargando && !filas ? (
        <Cargando />
      ) : (
        filas && (
          <div className="card tabla-scroll">
            <table>
              <thead>
                <tr>
                  {columnas.map((c) => (
                    <th key={c.name} className={['entero', 'numero', 'dinero'].includes(c.type) ? 'num' : ''}>
                      {c.label}
                    </th>
                  ))}
                  {conOrigen && <th>Origen</th>}
                  {tieneAcciones && <th><span className="sr-only">Acciones</span></th>}
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr><td colSpan={columnas.length + 1} className="texto-suave">
                    {filtro ? 'Ningún registro coincide con el filtro.' : 'Sin registros. Agregue uno o importe el Excel.'}
                  </td></tr>
                )}
                {visibles.map((fila) => (
                  <tr key={recurso.llave.map((k) => fila[k]).join('|')}>
                    {columnas.map((c) => (
                      <td key={c.name} className={['entero', 'numero', 'dinero'].includes(c.type) ? 'num' : ['periodo', 'fecha', 'dinero'].includes(c.type) ? 'nowrap' : ''}>
                        {celda(c, fila)}
                      </td>
                    ))}
                    {conOrigen && (
                      <td className="nowrap">
                        <span className={`rounded-full px-2 py-0.5 text-label-sm font-semibold ${fila.origen === 'gestion' ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant'}`}
                          title={fila.origen === 'gestion' ? 'Calculado desde Gestión académica' : 'Registro histórico de la hoja'}>
                          {fila.origen === 'gestion' ? 'Gestión' : 'Registro'}
                        </span>
                      </td>
                    )}
                    {tieneAcciones && (
                      <td className="acciones">
                        {tieneDetalles && (
                          <button type="button" className="btn-enlace text-indigo-600 font-medium" onClick={() => setViendoDetalles(fila)}>Detalles</button>
                        )}
                        {editable && (
                          <>
                            <button type="button" className="btn-enlace" onClick={() => setEditando(fila)}>Editar</button>
                            <button type="button" className="btn-enlace peligro" onClick={() => eliminar(fila)}>Eliminar</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {editando && (
        <RecursoFormulario
          recurso={recurso}
          fila={editando === 'nuevo' ? null : editando}
          cohortes={cohortes}
          onClose={() => setEditando(null)}
          onGuardar={(datos) =>
            tras(editando === 'nuevo' ? adminApi.crear(recurso, datos) : adminApi.actualizar(recurso, editando, datos))
          }
        />
      )}
    </section>
  )
}
