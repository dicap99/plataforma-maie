import { useState } from 'react'
import { Link } from 'react-router-dom'
import CsvUploaderModal from '../features/admin/CsvUploaderModal.jsx'

export default function CoordinadorDashboard() {
  const [importando, setImportando] = useState(false)

  return (
    <>
      <h1>Panel de Coordinación</h1>
      <div className="grid-tarjetas">
        <article className="card">
          <h2>Procesos administrativos</h2>
          <p className="texto-suave">Cohortes, cursos, presupuesto, investigación y perfiles docentes.</p>
          <Link to="cohortes">Cohortes y cursos</Link> · <Link to="presupuesto">Presupuesto</Link>
        </article>
        <article className="card">
          <h2>Importación masiva</h2>
          <p className="texto-suave">Carga de archivos .csv / .xlsx a partir de las plantillas oficiales.</p>
          <button className="btn btn-primario" onClick={() => setImportando(true)}>
            Importar archivo
          </button>
        </article>
        <article className="card">
          <h2>Resultados de aprendizaje</h2>
          <p className="texto-suave">Consolidado RA1–RA7 por estudiante, curso, módulo y cohorte.</p>
          <Link to="ra">Ver reportes</Link>
        </article>
        <article className="card">
          <h2>Evaluación docente</h2>
          <p className="texto-suave">Periodos, Evaluación de Coordinación (EC) e informes del Acuerdo 058.</p>
          <Link to="evaluacion-coordinacion">Diligenciar EC</Link>
        </article>
      </div>
      {importando && <CsvUploaderModal onClose={() => setImportando(false)} />}
    </>
  )
}
