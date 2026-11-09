import { useState } from 'react'
import * as raApi from '../../api/raApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'

// Apertura de la calificación de rúbricas (RF-RA-02): cada curso se evalúa al final de su semestre y
// Coordinación abre o cierra la calificación de todos los cursos del semestre académico a la vez.
// Solo afecta a las rúbricas de RA; la evaluación docente tendrá su propia habilitación en su módulo.
export default function AperturaCalificacionPage() {
  const periodos = useApi(raApi.listarPeriodos)
  const [cambiando, setCambiando] = useState(null)
  const [error, setError] = useState(null)

  const alternar = async (p) => {
    setCambiando(p.periodo)
    setError(null)
    try {
      await raApi.cambiarPeriodo(p.periodo, !p.abierto)
      await periodos.recargar()
    } catch (err) {
      setError(err)
    } finally {
      setCambiando(null)
    }
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-1 pb-2">
        <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
          <Icono nombre="lock_clock" className="text-[16px]" /> Resultados de aprendizaje
        </div>
        <h1 className="m-0 mt-1 font-display text-headline-lg tracking-tight text-primary">Apertura de calificación de rúbricas</h1>
        <p className="m-0 max-w-4xl text-body-md text-on-surface-variant">
          Habilita, por semestre académico, el registro de las rúbricas de RA en todos los cursos ofertados. Mientras el
          semestre está cerrado, los docentes solo consultan sus planillas. Abra la calificación al final del semestre y
          ciérrela cuando los docentes hayan registrado las rúbricas.
        </p>
      </header>

      <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        <ErrorApi error={error ?? periodos.error} onReintentar={periodos.error ? periodos.recargar : undefined} />
        {periodos.cargando && !periodos.data ? <Cargando /> : (
          <div className="tabla-scroll">
            <table className="text-body-sm">
              <thead>
                <tr><th>Semestre académico</th><th className="num">Cursos ofertados</th><th>Calificación</th><th>Último cambio</th><th><span className="sr-only">Acciones</span></th></tr>
              </thead>
              <tbody>
                {(periodos.data ?? []).map((p) => (
                  <tr key={p.periodo}>
                    <td className="font-semibold text-primary">{p.periodo}</td>
                    <td className="num">{p.cursos}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label-sm font-bold ${
                        p.abierto ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        <Icono nombre={p.abierto ? 'lock_open' : 'lock'} className="text-[14px]" /> {p.abierto ? 'Abierta' : 'Cerrada'}
                      </span>
                    </td>
                    <td className="texto-suave">{p.actualizado_en ? new Date(p.actualizado_en).toLocaleString('es-CO') : '—'}</td>
                    <td className="acciones">
                      <button type="button" className={p.abierto ? 'btn btn-secundario' : 'btn btn-primario'}
                        disabled={cambiando !== null} onClick={() => alternar(p)}>
                        {cambiando === p.periodo ? 'Guardando…' : p.abierto ? 'Cerrar calificación' : 'Abrir calificación'}
                      </button>
                    </td>
                  </tr>
                ))}
                {periodos.data?.length === 0 && (
                  <tr><td colSpan={5} className="texto-suave">Aún no hay cursos ofertados (se ofertan en Gestión académica › Asignación por semestre).</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
