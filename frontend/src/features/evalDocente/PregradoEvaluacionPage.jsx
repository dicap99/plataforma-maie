import { useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import * as evalApi from '../../api/evalDocenteApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import { Encabezado, Seccion } from './comun.jsx'

// Estudiantes de pregrado que toman cursos de la maestría (asesoría del 20-oct-2026): lista por semestre,
// promoción y curso, cargada con la plantilla Excel en dos pasos (validar → confirmar, todo o nada),
// como la importación del Módulo 1. Las cuentas nuevas reciben una contraseña temporal que solo se
// muestra al confirmar.
const descargarCsv = (filas) => {
  const csv = ['Identificación;Nombre;Correo;Contraseña temporal', ...filas.map((c) => [c.identificacion, c.nombre, c.email, c.password].join(';'))].join('\n')
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  enlace.download = 'credenciales_pregrado.csv'
  enlace.click()
  URL.revokeObjectURL(enlace.href)
}

function Importar({ periodo, onImportado }) {
  const [archivo, setArchivo] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    onDrop: (a) => { setArchivo(a[0] ?? null); setResultado(null) },
  })
  const ejecutar = async (simular) => {
    setProcesando(true)
    try {
      const { data } = await evalApi.importarPregrado(archivo, simular)
      setResultado({ ok: true, simular, data })
      if (!simular) onImportado()
    } catch (error) {
      setResultado({ ok: false, error })
    } finally {
      setProcesando(false)
    }
  }
  const resumen = resultado?.ok ? resultado.data.resumen : resultado?.error?.details?.resumen
  const errores = resultado?.error?.details?.errores ?? []

  return (
    <Seccion>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 font-display text-headline-sm text-primary">Cargar la lista</h2>
        <button type="button" className="btn btn-secundario" onClick={() => evalApi.plantillaPregrado(periodo || undefined)}>
          <Icono nombre="download" className="text-[18px]" /> Descargar plantilla
        </button>
      </div>
      <p className="m-0 text-body-sm text-on-surface-variant">
        Una fila por estudiante y curso: semestre académico, promoción, curso (código o nombre de la clase), identificación, nombres,
        apellidos, correo y programa de pregrado. La hoja «Ofertas (referencia)» de la plantilla trae las ofertas registradas.
      </p>
      <div {...getRootProps()} className={`cursor-pointer rounded-xl border-2 border-dashed p-space-md text-center ${isDragActive ? 'border-secondary bg-secondary-fixed/30' : 'border-outline-variant'}`}>
        <input {...getInputProps()} />
        <Icono nombre="upload_file" className="text-[28px] text-secondary" />
        <p className="m-0 text-body-md">{archivo ? archivo.name : 'Arrastre la plantilla .xlsx o haga clic para elegirla'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secundario" disabled={!archivo || procesando} onClick={() => ejecutar(true)}>1. Validar</button>
        <button type="button" className="btn btn-primario" disabled={!(resultado?.ok && resultado.simular) || procesando} onClick={() => ejecutar(false)}>2. Confirmar carga</button>
      </div>
      {resultado && !resultado.ok && <ErrorApi error={resultado.error} />}
      {resumen && (
        <p className="m-0 text-body-sm" role="status">
          {resultado.ok && resultado.simular ? 'Validación sin errores: ' : resultado.ok ? 'Carga confirmada: ' : 'Resumen: '}
          {resumen.filas} fila(s) · {resumen.usuarios_nuevos} cuenta(s) nueva(s) · {resumen.inscripciones_nuevas} inscripción(es) nueva(s) · {resumen.actualizadas} actualizada(s).
        </p>
      )}
      {errores.length > 0 && (
        <div className="tabla-scroll">
          <table className="text-body-sm">
            <thead><tr><th className="num">Fila</th><th>Error</th></tr></thead>
            <tbody>{errores.map((e, i) => <tr key={i}><td className="num">{e.fila}</td><td>{e.mensaje}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {resultado?.ok && !resultado.simular && resultado.data.credenciales?.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl bg-error-container/30 p-3">
          <p className="m-0 text-body-sm">
            <strong>Credenciales temporales de las cuentas nuevas.</strong> Solo se muestran ahora: descárguelas y entréguelas a cada
            estudiante. Al entrar, la plataforma le pedirá cambiar la contraseña.
          </p>
          <button type="button" className="btn btn-secundario self-start" onClick={() => descargarCsv(resultado.data.credenciales)}>
            <Icono nombre="key" className="text-[18px]" /> Descargar credenciales (CSV)
          </button>
        </div>
      )}
    </Seccion>
  )
}

export default function PregradoEvaluacionPage() {
  const periodos = useApi(evalApi.listarPeriodos)
  const [periodo, setPeriodo] = useState('')
  const lista = useApi(() => evalApi.listarPregrado(periodo || undefined), [periodo])
  const [error, setError] = useState(null)

  const grupos = useMemo(() => {
    const m = new Map()
    for (const f of lista.data ?? []) {
      const k = `${f.periodo} · Promoción ${f.cohorte} · ${f.clase} (${f.clase_codigo})`
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(f)
    }
    return [...m.entries()]
  }, [lista.data])

  const accion = async (fn) => {
    setError(null)
    try {
      await fn()
      await lista.recargar()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <Encabezado icono="school" titulo="Estudiantes de pregrado">
        Estudiantes de pregrado que toman cursos de la maestría, por semestre, promoción y curso. Evalúan a los docentes de sus cursos
        cuando la evaluación del semestre incluye el pregrado (Habilitación y seguimiento). No entran en las rúbricas de resultados de aprendizaje.
      </Encabezado>

      <Importar periodo={periodo} onImportado={lista.recargar} />

      <Seccion>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="m-0 font-display text-headline-sm text-primary">Lista registrada</h2>
          <label className="flex flex-col gap-1 text-label-sm font-semibold uppercase text-on-surface-variant">Semestre académico
            <select className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md normal-case"
              value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              <option value="">Todos</option>
              {(periodos.data ?? []).map((p) => <option key={p.periodo} value={p.periodo}>{p.periodo}</option>)}
            </select>
          </label>
        </div>
        <ErrorApi error={error ?? lista.error} />
        {lista.cargando && !lista.data ? <Cargando /> : grupos.length === 0 ? (
          <p className="texto-suave">No hay estudiantes de pregrado registrados{periodo ? ` en ${periodo}` : ''}.</p>
        ) : grupos.map(([titulo, filas]) => (
          <div key={titulo} className="flex flex-col gap-1">
            <h3 className="m-0 text-body-md font-semibold text-primary">{titulo} <span className="font-normal text-on-surface-variant">· {filas.length}</span></h3>
            <div className="tabla-scroll">
              <table className="text-body-sm">
                <thead><tr><th>Identificación</th><th>Estudiante</th><th>Correo</th><th>Programa</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={`${f.id_curso}|${f.id_estudiante}`}>
                      <td>{f.identificacion}</td>
                      <td>{f.apellidos} {f.nombres}</td>
                      <td>{f.email}</td>
                      <td>{f.programa ?? '—'}</td>
                      <td>{f.estado === 'retirado' ? 'Retirado' : 'Inscrito'}{f.activo ? '' : ' · cuenta inactiva'}</td>
                      <td className="acciones whitespace-nowrap">
                        <button type="button" className="btn btn-secundario"
                          onClick={() => accion(() => evalApi.estadoPregrado(f.id_curso, f.id_estudiante, f.estado === 'retirado' ? 'inscrito' : 'retirado'))}>
                          {f.estado === 'retirado' ? 'Reincorporar' : 'Retirar'}
                        </button>{' '}
                        <button type="button" className="btn btn-secundario" onClick={() => accion(() => evalApi.quitarPregrado(f.id_curso, f.id_estudiante))}>Quitar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </Seccion>
    </div>
  )
}
