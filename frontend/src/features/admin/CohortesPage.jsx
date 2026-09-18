import PendienteAviso from '../../components/common/PendienteAviso.jsx'

// Gestión académica: estudiantes por cohorte y cursos dictados (RF-ADM-01).
export default function CohortesPage({ cohortes = [] }) {
  return (
    <>
      <h1>Cohortes</h1>
      <PendienteAviso requisito="RF-ADM-01 — conectar con /admin/cohortes y /admin/cursos" />
      <div className="card tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Cohorte</th>
              <th>Periodo</th>
              <th>Inscritos</th>
              <th>Matriculados</th>
              <th>Egresados</th>
              <th>Graduados</th>
            </tr>
          </thead>
          <tbody>
            {cohortes.map((c) => (
              <tr key={c.id_cohorte}>
                <td>{c.nombre}</td>
                <td>{c.anio_inicio}–{c.anio_fin}</td>
                <td>{c.inscritos}</td>
                <td>{c.matriculados}</td>
                <td>{c.egresados}</td>
                <td>{c.graduados}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
