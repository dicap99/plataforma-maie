import { Link } from 'react-router-dom'

export default function DocenteDashboard() {
  return (
    <>
      <h1>Panel Docente</h1>
      <div className="grid-tarjetas">
        <article className="card">
          <h2>Calificar rúbricas</h2>
          <p className="texto-suave">Evalúe a los estudiantes de sus cursos con la rúbrica de cada RA.</p>
          <Link to="rubricas">Ir a rúbricas</Link>
        </article>
        <article className="card">
          <h2>Autoevaluación (AE)</h2>
          <p className="texto-suave">Formulario del Acuerdo 058 para el periodo abierto.</p>
          <Link to="autoevaluacion">Diligenciar</Link>
        </article>
        <article className="card">
          <h2>Mis resultados</h2>
          <p className="texto-suave">Consolidado EE, AE y EC una vez publicado el periodo.</p>
          <Link to="resultados">Consultar</Link>
        </article>
      </div>
    </>
  )
}
