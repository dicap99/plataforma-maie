import { Link } from 'react-router-dom'

export default function EstudianteDashboard() {
  return (
    <>
      <h1>Panel Estudiante</h1>
      <article className="card">
        <h2>Evaluación de docentes (EE)</h2>
        <p className="texto-suave">Evalúe la labor de sus docentes al finalizar el semestre.</p>
        <Link className="btn btn-primario" to="evaluacion">
          Comenzar evaluación
        </Link>
      </article>
    </>
  )
}
