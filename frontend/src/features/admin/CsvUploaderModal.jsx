import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { importarArchivo } from '../../api/adminApi'

const TIPOS = [
  { value: 'cohortes', label: 'Cohortes' },
  { value: 'cursos', label: 'Cursos' },
  { value: 'estudiantes', label: 'Estudiantes' },
  { value: 'docentes', label: 'Docentes' },
  { value: 'presupuesto', label: 'Presupuesto' },
]

// Modal drag-and-drop para importación masiva CSV/Excel (RF-ADM-01, RF-ADM-02).
export default function CsvUploaderModal({ onClose }) {
  const [tipo, setTipo] = useState(TIPOS[0].value)
  const [archivo, setArchivo] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    onDrop: (aceptados) => setArchivo(aceptados[0] ?? null),
  })

  const importar = async () => {
    setEnviando(true)
    setMensaje(null)
    try {
      await importarArchivo(tipo, archivo)
      setMensaje({ ok: true, texto: 'Archivo importado correctamente' })
    } catch (err) {
      setMensaje({ ok: false, texto: err.message })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="modal-fondo" role="dialog" aria-modal="true" aria-labelledby="titulo-importar">
      <div className="card modal">
        <h2 id="titulo-importar">Importar datos</h2>
        <div className="campo">
          <label htmlFor="tipo">Tipo de datos</label>
          <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div {...getRootProps({ className: `zona-arrastre${isDragActive ? ' activa' : ''}` })}>
          <input {...getInputProps()} />
          {archivo
            ? <strong>{archivo.name}</strong>
            : <span>Arrastre un archivo .csv o .xlsx, o haga clic para seleccionarlo</span>}
        </div>
        {mensaje && <p className={mensaje.ok ? '' : 'alerta-error'}>{mensaje.texto}</p>}
        <div className="modal-acciones">
          <button className="btn btn-secundario" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primario" disabled={!archivo || enviando} onClick={importar}>
            {enviando ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  )
}
