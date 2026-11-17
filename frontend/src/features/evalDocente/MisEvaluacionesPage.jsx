import { useState } from 'react'
import * as evalApi from '../../api/evalDocenteApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import FormularioAcuerdo058 from './FormularioAcuerdo058.jsx'
import { Encabezado, ETIQUETA_FORMULARIO } from './comun.jsx'

// Formularios que le corresponden al usuario en los semestres habilitados (GET /eval-docente/pendientes):
// estudiante → un EE por docente; docente → su AE por promoción; Coordinación → una EC por docente y promoción.
// Quién evalúa a quién lo decide el backend (categorizacion.js); aquí solo se listan y se diligencian.
const TEXTOS = {
  EE: {
    icono: 'assignment_ind', titulo: 'Evaluar a mis docentes',
    intro: 'Evalúe a cada docente de los cursos que tomó este semestre. Sus respuestas son anónimas y cada docente se evalúa una sola vez, aunque le haya dictado varios cursos.',
    vacio: 'No tiene docentes por evaluar: la evaluación no está habilitada o usted no tiene cursos en el semestre.',
  },
  AE: {
    icono: 'rate_review', titulo: 'Mi autoevaluación (AE)',
    intro: 'Diligencie su autoevaluación en cada promoción en la que tuvo cursos este semestre. Puede corregirla mientras la evaluación esté abierta.',
    vacio: 'No tiene autoevaluaciones pendientes: la evaluación no está habilitada o no tiene cursos asignados en el semestre.',
  },
  EC: {
    icono: 'assignment_ind', titulo: 'Evaluación de Coordinación (EC)',
    intro: 'Evalúe a cada docente con cursos en el semestre, una vez por promoción. Puede corregir la evaluación mientras esté abierta. Si usted también es docente del semestre, aquí aparece su autoevaluación (AE); su propio perfil no se evalúa con la EC.',
    vacio: 'No hay docentes por evaluar: habilite la evaluación del semestre en «Habilitación y seguimiento».',
  },
}

export default function MisEvaluacionesPage({ tipo }) {
  const pendientes = useApi(evalApi.pendientes)
  const [abierto, setAbierto] = useState(null)
  const [aviso, setAviso] = useState(null)
  const textos = TEXTOS[tipo]

  if (abierto) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-space-md">
        <FormularioAcuerdo058 objetivo={abierto} onCancelar={() => setAbierto(null)}
          onEnviado={() => {
            setAviso(abierto.tipo === 'EE' ? `Evaluación de ${abierto.docente} enviada. ¡Gracias!` : `${ETIQUETA_FORMULARIO[abierto.tipo]} de ${abierto.docente} guardada.`)
            setAbierto(null)
            pendientes.recargar()
            window.scrollTo(0, 0)
          }} />
      </div>
    )
  }

  const semestres = (pendientes.data ?? []).map((s) => ({ ...s, formularios: s.formularios.filter((f) => f.tipo === tipo || (tipo === 'EC' && f.tipo === 'AE')) }))
  const hay = semestres.some((s) => s.formularios.length)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-space-lg">
      <Encabezado icono={textos.icono} titulo={textos.titulo}>{textos.intro}</Encabezado>
      {aviso && <p className="m-0 rounded-xl bg-secondary-fixed/50 p-3 text-body-md text-on-surface" role="status">{aviso}</p>}
      <ErrorApi error={pendientes.error} onReintentar={pendientes.recargar} />
      {pendientes.cargando && !pendientes.data ? <Cargando /> : !hay ? (
        <p className="m-0 rounded-xl bg-surface-container-lowest p-space-md text-body-md text-on-surface-variant shadow-sm">{textos.vacio}</p>
      ) : semestres.filter((s) => s.formularios.length).map((s) => {
        const hechos = s.formularios.filter((f) => f.diligenciado).length
        return (
          <section key={s.periodo} className="flex flex-col gap-space-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 font-display text-headline-sm text-primary">Semestre {s.periodo}</h2>
              <span className="text-body-sm text-on-surface-variant">
                {hechos} de {s.formularios.length} diligenciados{s.fecha_cierre ? ` · cierra el ${String(s.fecha_cierre).slice(0, 10)}` : ''}
              </span>
            </div>
            {!s.abierta && <p className="m-0 rounded-lg bg-surface-container-high p-2 text-body-sm text-on-surface-variant">{s.motivo}</p>}
            <ul className="m-0 grid list-none gap-space-sm p-0 sm:grid-cols-2">
              {s.formularios.map((f) => {
                const bloqueado = !s.abierta || (f.tipo === 'EE' && f.diligenciado)
                return (
                  <li key={`${f.tipo}|${f.id_docente}|${f.id_cohorte}`}
                    className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="m-0 font-semibold text-primary">{f.docente}{tipo === 'EC' && f.tipo === 'AE' ? ' · su autoevaluación (AE)' : ''}</p>
                        <p className="m-0 text-body-sm text-on-surface-variant">
                          Promoción {f.cohorte}{f.cursos?.length ? ` · ${f.cursos.map((c) => c.clase ?? c).join(', ')}` : ''}
                        </p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-bold ${
                        f.diligenciado ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        <Icono nombre={f.diligenciado ? 'check_circle' : 'pending'} className="text-[14px]" />
                        {f.diligenciado ? 'Diligenciado' : 'Pendiente'}
                      </span>
                    </div>
                    {!bloqueado && (
                      <button type="button" className={f.diligenciado ? 'btn btn-secundario' : 'btn btn-primario'}
                        onClick={() => { setAviso(null); setAbierto({ ...f, periodo: s.periodo, cursos: f.cursos?.map((c) => c.clase ?? c) }) }}>
                        {f.diligenciado ? 'Revisar y corregir' : 'Diligenciar'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
