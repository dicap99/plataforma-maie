import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { descargarPlantilla, importarArchivo } from '../../api/adminApi'
import Modal from '../../components/common/Modal.jsx'

const FORMATOS = {
  estadisticas: 'Libro histórico «Estadísticas MaIE»',
  plantilla: 'Plantilla oficial de importación',
  csv: 'CSV de una hoja',
}

// Importación masiva CSV/Excel (RF-ADM-01, RF-ADM-02) en dos pasos:
// 1) validar (simulación, no guarda nada)  2) importar (todo o nada).
export default function CsvUploaderModal({ recursos, onClose, onImportado }) {
  const [archivo, setArchivo] = useState(null)
  const [recursoCsv, setRecursoCsv] = useState('')
  const [resultado, setResultado] = useState(null) // { ok, simulacion, data | error }
  const [procesando, setProcesando] = useState(false)

  const esCsv = archivo?.name.toLowerCase().endsWith('.csv')

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    onDrop: (aceptados) => {
      setArchivo(aceptados[0] ?? null)
      setResultado(null)
    },
  })

  const ejecutar = async (simular) => {
    setProcesando(true)
    try {
      const { data } = await importarArchivo(archivo, { simular, ...(esCsv ? { recurso: recursoCsv } : {}) })
      setResultado({ ok: true, simulacion: simular, data })
      if (!simular) onImportado?.()
    } catch (error) {
      setResultado({ ok: false, simulacion: simular, error })
    } finally {
      setProcesando(false)
    }
  }

  const datos = resultado?.ok ? resultado.data : resultado?.error?.details
  const listoParaImportar = resultado?.ok && resultado.simulacion

  return (
    <Modal titulo="Importar datos" onClose={onClose} ancho={640}>
      <p className="texto-suave">
        Suba el libro «Estadísticas MaIE» tal como lo maneja Coordinación, la plantilla oficial o un CSV de una sola hoja.
        Primero se valida y luego se confirma la importación; si hay errores no se guarda nada.
      </p>
      <p>
        <button type="button" className="btn-enlace" onClick={() => descargarPlantilla(false)}>Descargar plantilla vacía</button>
      </p>

      <div {...getRootProps({ className: `zona-arrastre${isDragActive ? ' activa' : ''}` })}>
        <input {...getInputProps()} />
        {archivo ? <strong>{archivo.name}</strong> : <span>Arrastre un archivo .xlsx o .csv, o haga clic para seleccionarlo</span>}
      </div>

      {esCsv && (
        <div className="campo" style={{ marginTop: '1rem' }}>
          <label htmlFor="recurso-csv">Hoja destino del CSV</label>
          <select id="recurso-csv" value={recursoCsv} onChange={(e) => setRecursoCsv(e.target.value)} required>
            <option value="">Seleccione…</option>
            {recursos.filter((r) => r.editable && r.id !== 'parametros').map((r) => (
              <option key={r.id} value={r.id}>{r.titulo}</option>
            ))}
          </select>
        </div>
      )}

      {resultado && (
        <div className="resultado-importacion" role="status">
          <p className={resultado.ok ? 'texto-exito' : 'alerta-error'}>
            {resultado.ok
              ? resultado.simulacion
                ? `Archivo válido (${FORMATOS[datos.formato]}). Revise el resumen y confirme la importación.`
                : 'Importación completada.'
              : resultado.error.message}
          </p>
          {datos?.resumen?.length > 0 && (
            <div className="tabla-scroll">
              <table className="tabla-compacta">
                <thead><tr><th>Hoja</th><th className="num">Filas</th><th className="num">Nuevas</th><th className="num">Actualizadas</th></tr></thead>
                <tbody>
                  {datos.resumen.map((r) => (
                    <tr key={r.hoja}><td>{r.hoja}</td><td className="num">{r.filas}</td><td className="num">{r.insertados}</td><td className="num">{r.actualizados}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {datos?.errores?.length > 0 && (
            <details open>
              <summary>{datos.errores.length} error(es)</summary>
              <ul className="lista-mensajes">
                {datos.errores.map((e, i) => <li key={i}><strong>{e.hoja}, fila {e.fila}:</strong> {e.mensaje}</li>)}
              </ul>
            </details>
          )}
          {datos?.advertencias?.length > 0 && (
            <details>
              <summary>{datos.advertencias.length} advertencia(s)</summary>
              <ul className="lista-mensajes">
                {datos.advertencias.map((e, i) => <li key={i}><strong>{e.hoja}, fila {e.fila}:</strong> {e.mensaje}</li>)}
              </ul>
            </details>
          )}
          {datos?.hojasFaltantes?.length > 0 && (
            <p className="texto-suave">Hojas no encontradas (se omiten): {datos.hojasFaltantes.join(', ')}</p>
          )}
        </div>
      )}

      <div className="modal-acciones">
        <button type="button" className="btn btn-secundario" onClick={onClose}>Cerrar</button>
        {listoParaImportar ? (
          <button type="button" className="btn btn-primario" disabled={procesando} onClick={() => ejecutar(false)}>
            {procesando ? 'Importando…' : 'Confirmar importación'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primario"
            disabled={!archivo || procesando || (esCsv && !recursoCsv) || (resultado?.ok && !resultado.simulacion)}
            onClick={() => ejecutar(true)}
          >
            {procesando ? 'Validando…' : 'Validar archivo'}
          </button>
        )}
      </div>
    </Modal>
  )
}
