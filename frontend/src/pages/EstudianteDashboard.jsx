import { Link } from 'react-router-dom'
import * as evalApi from '../api/evalDocenteApi'
import useApi from '../hooks/useApi'
import Icono from '../components/common/Icono.jsx'

// Panel del estudiante: su única tarea es evaluar a sus docentes (Documento Técnico, interfaz del
// estudiante): plazo, avance y acceso directo, con la declaración de anonimato.
export default function EstudianteDashboard() {
  const pendientes = useApi(evalApi.pendientes)
  const formularios = (pendientes.data ?? []).flatMap((s) => s.formularios.map((f) => ({ ...f, abierta: s.abierta, fecha_cierre: s.fecha_cierre, periodo: s.periodo })))
  const faltan = formularios.filter((f) => !f.diligenciado && f.abierta).length
  const cierre = formularios.find((f) => f.fecha_cierre)?.fecha_cierre

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-space-md">
      <h1 className="m-0 font-display text-headline-lg text-primary">Panel del estudiante</h1>
      <article className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        <h2 className="m-0 flex items-center gap-2 font-display text-headline-sm text-primary">
          <Icono nombre="assignment_ind" /> Evaluación de docentes (EE)
        </h2>
        {pendientes.cargando ? <p className="texto-suave">Cargando…</p> : formularios.length === 0 ? (
          <p className="m-0 text-body-md text-on-surface-variant">No hay una evaluación docente habilitada para usted en este momento.</p>
        ) : (
          <>
            <p className="m-0 text-body-md">
              {faltan ? `Tiene ${faltan} docente(s) por evaluar` : 'Ya evaluó a todos sus docentes'} del semestre {formularios[0].periodo}
              {cierre ? ` · la evaluación cierra el ${String(cierre).slice(0, 10)}` : ''}.
            </p>
            <p className="m-0 flex items-start gap-2 text-body-sm text-on-surface-variant">
              <Icono nombre="visibility_off" className="text-[18px]" /> Sus respuestas son anónimas: nadie puede saber qué contestó.
            </p>
          </>
        )}
        <Link className="btn btn-primario self-start" to="evaluacion">{faltan ? 'Evaluar a mis docentes' : 'Ver mis evaluaciones'}</Link>
      </article>
    </div>
  )
}
