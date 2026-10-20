import { useState } from 'react'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import { valorCampo } from '../../utils/formato'
import RecursoFormulario from './RecursoFormulario.jsx'
import TablaPromociones from './academico/TablaPromociones.jsx'
import InsigniaPromocion from './academico/InsigniaPromocion.jsx'

// Tabla editable de un recurso del Módulo 1 (una hoja de "Estadísticas MaIE").
// `filtro` = { etiqueta, fn } limita las filas visibles (p. ej. al hacer clic en una gráfica).
// `soloLectura`: sin agregar, editar ni eliminar. `filasExternas`: filas ya calculadas (p. ej. el reflejo
// de Gestión académica) en lugar de las de la hoja; si traen `origen`, se muestra de dónde sale cada fila.
export default function RecursoTabla({
  recurso,
  cohortes,
  onCambio,
  filtro,
  onQuitarFiltro,
  soloLectura = false,
  filasExternas,
}) {
  const api = useApi(
    () => (filasExternas ? Promise.resolve({ data: null }) : adminApi.listar(recurso.id)),
    [recurso.id, Boolean(filasExternas)]
  )
  const filas = filasExternas ?? api.data
  const { error, cargando, recargar } = api
  const editable = recurso.editable && !soloLectura
  const conOrigen = (filas ?? []).some((f) => f.origen)
  const [editando, setEditando] = useState(null)
  const [viendoDetalles, setViendoDetalles] = useState(null)
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

  // Renderizado contextual de celda con badges distintivos para promociones y periodos
  const celda = (campo, fila) => {
    if (campo.type === 'cohorte') {
      const nombreCohorte = fila.cohorte ?? fila.nombre
      return <InsigniaPromocion nombre={nombreCohorte} />
    }
    if (campo.type === 'periodo') {
      const v = fila[campo.name]
      return v ? (
        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold border border-slate-200/60">
          {v}
        </span>
      ) : (
        '—'
      )
    }
    if (campo.type === 'dinero') {
      return (
        <span className="font-mono text-slate-800 font-medium tabular-numbers">
          {valorCampo(campo, fila[campo.name])}
        </span>
      )
    }
    if (campo.type === 'entero' || campo.type === 'numero') {
      return (
        <span className="tabular-numbers font-medium text-slate-800">
          {valorCampo(campo, fila[campo.name])}
        </span>
      )
    }
    return valorCampo(campo, fila[campo.name])
  }

  const tieneDetalles = recurso.id === 'produccion' || recurso.campos.some((c) => c.name === 'detalles' && c.multilinea)
  const tieneAcciones = editable || tieneDetalles

  if (viendoTodosDetalles) {
    return (
      <section className="animate-fade-in">
        <header className="barra-herramientas mb-4 flex items-center justify-between">
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
          {visibles.map((fila) => (
            <div key={fila.id_cohorte} className="card p-6 bg-white shadow-sm border border-slate-200 rounded-xl">
              <div className="mb-3 border-b pb-2">
                <InsigniaPromocion nombre={fila.cohorte} />
              </div>
              {fila.detalles ? (
                <div className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100 font-sans text-xs leading-relaxed">
                  {fila.detalles}
                </div>
              ) : (
                <p className="text-slate-400 italic text-xs">No hay detalles registrados para esta promoción.</p>
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
        <div className="card p-6 bg-white shadow-sm border border-slate-200 rounded-xl max-w-3xl mx-auto my-4">
          <div className="flex items-center justify-between mb-4 border-b pb-3">
            <div className="flex items-center space-x-3">
              <InsigniaPromocion nombre={viendoDetalles.cohorte} />
              <span className="text-sm font-semibold text-slate-700">· Detalles registrados</span>
            </div>
            <button type="button" className="btn btn-secundario btn-sm" onClick={() => setViendoDetalles(null)}>
              Cerrar
            </button>
          </div>
          {viendoDetalles.detalles ? (
            <div className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100 font-sans text-xs leading-relaxed">
              {viendoDetalles.detalles}
            </div>
          ) : (
            <p className="text-slate-500 italic text-xs">No hay detalles registrados para esta promoción.</p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section>
      {/* Barra de herramientas / filtros */}
      {(filtro || tieneDetalles || editable) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {filtro && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200/80 px-3 py-1 text-xs font-semibold text-indigo-700">
                <span className="material-symbols-outlined text-[15px]" aria-hidden="true">filter_alt</span>
                {filtro.etiqueta}
                <button
                  type="button"
                  className="ml-1 grid place-items-center rounded-full hover:bg-indigo-100 text-indigo-500"
                  onClick={onQuitarFiltro}
                  aria-label="Quitar filtro"
                >
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">close</span>
                </button>
              </span>
            )}
            {tieneDetalles && filas?.length > 0 && (
              <button
                type="button"
                className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/70 transition-colors cursor-pointer"
                onClick={() => setViendoTodosDetalles(true)}
              >
                <span className="material-symbols-outlined text-[15px]">visibility</span>
                <span>Ver todos los detalles</span>
              </button>
            )}
          </div>
          {editable && (
            <button
              type="button"
              className="btn btn-primario btn-sm ml-auto"
              onClick={() => setEditando('nuevo')}
            >
              Agregar registro
            </button>
          )}
        </header>
      )}

      {recurso.nota && (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">info</span>
          {recurso.nota}
        </p>
      )}
      <ErrorApi error={error} onReintentar={recargar} />
      <ErrorApi error={errorAccion} />

      {cargando && !filas ? (
        <Cargando />
      ) : (
        filas && (
          recurso.id === 'cohortes' ? (
            <TablaPromociones
              filas={visibles}
              editable={editable}
              conOrigen={conOrigen}
              onEditar={setEditando}
              onEliminar={eliminar}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      {columnas.map((c) => (
                        <th
                          key={c.name}
                          className={`py-3 px-3.5 ${
                            ['entero', 'numero', 'dinero'].includes(c.type) ? 'text-right' : 'text-left'
                          }`}
                        >
                          {c.label}
                        </th>
                      ))}
                      {conOrigen && <th className="py-3 px-3 text-center">Origen</th>}
                      {tieneAcciones && (
                        <th className="py-3 px-4 text-right">
                          <span className="sr-only">Acciones</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {visibles.length === 0 && (
                      <tr>
                        <td
                          colSpan={columnas.length + (conOrigen ? 1 : 0) + (tieneAcciones ? 1 : 0)}
                          className="py-8 text-center text-slate-400 italic"
                        >
                          {filtro ? 'Ningún registro coincide con el filtro.' : 'Sin registros. Agregue uno o importe el Excel.'}
                        </td>
                      </tr>
                    )}
                    {visibles.map((fila, i) => (
                      <tr
                        key={recurso.llave.map((k) => fila[k]).join('|') || i}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {columnas.map((c) => (
                          <td
                            key={c.name}
                            className={`py-3 px-3.5 ${
                              ['entero', 'numero', 'dinero'].includes(c.type)
                                ? 'text-right tabular-numbers font-medium'
                                : ['periodo', 'fecha'].includes(c.type)
                                ? 'nowrap'
                                : ''
                            }`}
                          >
                            {celda(c, fila)}
                          </td>
                        ))}
                        {conOrigen && (
                          <td className="py-3 px-3 text-center nowrap">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                                fila.origen === 'gestion'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                              title={
                                fila.origen === 'gestion'
                                  ? 'Calculado automáticamente desde Gestión académica'
                                  : 'Registro histórico cargado desde el Excel'
                              }
                            >
                              {fila.origen === 'gestion' ? 'Gestión' : 'Registro'}
                            </span>
                          </td>
                        )}
                        {tieneAcciones && (
                          <td className="py-3 px-4 text-right nowrap space-x-1.5">
                            {tieneDetalles && (
                              <button
                                type="button"
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 border border-indigo-200/60 rounded-md transition-colors cursor-pointer"
                                onClick={() => setViendoDetalles(fila)}
                              >
                                Detalles
                              </button>
                            )}
                            {editable && (
                              <>
                                <button
                                  type="button"
                                  className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                                  onClick={() => setEditando(fila)}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200/50 rounded-md transition-colors cursor-pointer"
                                  onClick={() => eliminar(fila)}
                                >
                                  Eliminar
                                </button>
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
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
