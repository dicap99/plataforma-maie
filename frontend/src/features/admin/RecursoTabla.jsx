import { useState } from 'react'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import { valorCampo } from '../../utils/formato'
import RecursoFormulario from './RecursoFormulario.jsx'

// Tabla editable de un recurso del Módulo 1 (una hoja de "Estadísticas MaIE").
export default function RecursoTabla({ recurso, cohortes, onCambio }) {
  const { data: filas, error, cargando, recargar } = useApi(() => adminApi.listar(recurso.id), [recurso.id])
  const [editando, setEditando] = useState(null) // null | 'nuevo' | fila
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

  const columnas = recurso.campos.filter((c) => !c.multilinea)
  const celda = (campo, fila) => (campo.type === 'cohorte' ? fila.cohorte : valorCampo(campo, fila[campo.name]))

  return (
    <section>
      <header className="barra-herramientas">
        <p className="texto-suave">
          {recurso.requisito} · Hoja «{recurso.hoja}» · {filas?.length ?? 0} registro(s)
        </p>
        {recurso.editable && (
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
                  {columnas.map((c) => <th key={c.name}>{c.label}</th>)}
                  {recurso.editable && <th><span className="sr-only">Acciones</span></th>}
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 && (
                  <tr><td colSpan={columnas.length + 1} className="texto-suave">Sin registros. Agregue uno o importe el Excel.</td></tr>
                )}
                {filas.map((fila) => (
                  <tr key={recurso.llave.map((k) => fila[k]).join('|')}>
                    {columnas.map((c) => (
                      <td key={c.name} className={['entero', 'numero', 'dinero'].includes(c.type) ? 'num' : ['periodo', 'fecha', 'dinero'].includes(c.type) ? 'nowrap' : ''}>
                        {celda(c, fila)}
                      </td>
                    ))}
                    {recurso.editable && (
                      <td className="acciones">
                        <button type="button" className="btn-enlace" onClick={() => setEditando(fila)}>Editar</button>
                        <button type="button" className="btn-enlace peligro" onClick={() => eliminar(fila)}>Eliminar</button>
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
