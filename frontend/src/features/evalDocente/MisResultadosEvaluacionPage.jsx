import { useState } from 'react'
import * as evalApi from '../../api/evalDocenteApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import ChartCard from '../../components/charts/ChartCard.jsx'
import GraficoLineas from '../../components/charts/GraficoLineas.jsx'
import DetalleUnidad from './DetalleUnidad.jsx'
import { Encabezado, ip, LeyendaCategorias, Seccion, ejePct } from './comun.jsx'

// RF-EVAL-05: el docente consulta en solo lectura sus resultados consolidados, únicamente de los semestres
// que Coordinación cerró y publicó. EE (anónima), EC y AE por separado; el Acuerdo no define cómo combinarlas.
export default function MisResultadosEvaluacionPage() {
  const res = useApi(evalApi.resultadosPropios)
  const [elegido, setElegido] = useState(null)
  const periodos = res.data?.periodos ?? []
  const actual = periodos.find((p) => p.periodo === elegido) ?? periodos.at(-1)

  // Variación histórica del %IP oficial por característica (EE), un punto por semestre y promoción.
  const filas = periodos.flatMap((p) => p.unidades.filter((u) => u.ee).map((u) => ({
    etiqueta: `${p.periodo} · ${u.cohorte}`,
    ...Object.fromEntries(u.ee.caracteristicas.filter((c) => c.cuenta_docente).map((c) => [`c${c.caracteristica}`, c.pct_ip])),
  })))
  const ks = [...new Set(periodos.flatMap((p) => p.unidades.flatMap((u) => u.ee?.caracteristicas ?? []))
    .filter((c) => c.cuenta_docente).map((c) => `${c.caracteristica}|${c.nombre}`))]

  return (
    <div className="flex flex-col gap-space-lg">
      <Encabezado icono="insights" titulo="Mis resultados de evaluación">
        Resultados de los semestres que Coordinación ya publicó. Las respuestas de los estudiantes son anónimas. Cada fuente (estudiantes,
        Coordinación y autoevaluación) se presenta por separado.
      </Encabezado>
      <ErrorApi error={res.error} onReintentar={res.recargar} />
      {res.cargando ? <Cargando /> : !periodos.length ? (
        <p className="m-0 rounded-xl bg-surface-container-lowest p-space-md text-body-md text-on-surface-variant shadow-sm">
          Aún no hay resultados publicados.
        </p>
      ) : (
        <>
          <Seccion>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label className="flex flex-col gap-1 text-label-sm font-semibold uppercase text-on-surface-variant">Semestre académico
                <select className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md normal-case"
                  value={actual.periodo} onChange={(e) => setElegido(e.target.value)}>
                  {periodos.map((p) => <option key={p.periodo} value={p.periodo}>{p.periodo}</option>)}
                </select>
              </label>
              <button type="button" className="btn btn-secundario" onClick={() => evalApi.informePropioPdf()}>
                <Icono nombre="picture_as_pdf" className="text-[18px]" /> Descargar informe PDF
              </button>
            </div>
            <LeyendaCategorias />
          </Seccion>
          {filas.length > 1 && (
            <ChartCard titulo="Variación histórica por característica (EE)" subtitulo="%IP oficial del Acuerdo 058 en cada semestre y promoción"
              tabla={{ columnas: [{ clave: 'etiqueta', titulo: 'Semestre · promoción' }, ...ks.map((k) => ({ clave: `c${k.split('|')[0]}`, titulo: `C${k.split('|')[0]}`, formato: ip }))], filas }}>
              <GraficoLineas datos={filas} ejeX="etiqueta" dominio={[0, 100]} formato={ip} formatoEje={ejePct}
                series={ks.map((k) => ({ clave: `c${k.split('|')[0]}`, nombre: `C${k.split('|')[0]}. ${k.split('|')[1]}` }))} />
            </ChartCard>
          )}
          {actual.unidades.map((u) => (
            <Seccion key={u.id_cohorte}>
              <h2 className="m-0 font-display text-headline-sm text-primary">{actual.periodo} · Promoción {u.cohorte}</h2>
              <DetalleUnidad unidad={u} />
            </Seccion>
          ))}
        </>
      )}
    </div>
  )
}
