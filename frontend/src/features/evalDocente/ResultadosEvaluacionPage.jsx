import { useEffect, useMemo, useState } from 'react'
import * as evalApi from '../../api/evalDocenteApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import Modal from '../../components/common/Modal.jsx'
import ChartCard from '../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../components/charts/GraficoBarras.jsx'
import GraficoLineas from '../../components/charts/GraficoLineas.jsx'
import TarjetaKpi, { BarraProgreso, Insignia } from '../admin/panel/TarjetaKpi.jsx'
import DetalleUnidad from './DetalleUnidad.jsx'
import {
  CategoriaInsignia, COLOR_CATEGORIA, colorDePct, Encabezado, ETIQUETA_POBLACION, ip, LeyendaCategorias, proporcion, Seccion, ejePct,
} from './comun.jsx'

// Resultados de la evaluación docente (RF-EVAL-02 a 04): consolidado oficial según el Acuerdo 058 de 2022.
// EE, EC y AE se reportan por separado (el Acuerdo no define ponderación entre fuentes).
const pct100 = (v) => (v === null || v === undefined ? null : v * 100)

function Selector({ etiqueta, valor, onChange, opciones }) {
  return (
    <label className="flex min-w-44 flex-1 flex-col gap-1 text-label-sm font-semibold uppercase text-on-surface-variant">
      {etiqueta}
      <select className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md normal-case text-on-surface"
        value={valor} onChange={(e) => onChange(e.target.value)}>
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
      </select>
    </label>
  )
}

function GraficoPromocion({ cohorte, unidades, caracteristicas }) {
  const [metrica, setMetrica] = useState('global')
  const conEE = unidades.filter((u) => u.ee)
  if (!conEE.length) return null
  const filas = conEE.map((u) => {
    if (metrica === 'global') {
      return { docente: u.docente, valor: u.ee.global?.pct_ip ?? null, sigla: u.ee.global?.sigla }
    }
    const c = u.ee.caracteristicas.find((x) => String(x.caracteristica) === metrica)
    return { docente: u.docente, valor: c?.pct_ip ?? null, sigla: c?.sigla }
  })
  const tituloMetrica = metrica === 'global'
    ? 'Global (EE)'
    : `C${metrica}. ${caracteristicas.find((x) => String(x.caracteristica) === metrica)?.nombre ?? ''}`
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-body-sm font-semibold text-on-surface-variant">Gráfica de desempeño por docente</span>
        <select aria-label={`Métrica por docente Promoción ${cohorte}`}
          className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-body-sm text-on-surface"
          value={metrica} onChange={(e) => setMetrica(e.target.value)}>
          <option value="global">%IP global (EE)</option>
          {caracteristicas.map((c) => <option key={c.caracteristica} value={String(c.caracteristica)}>C{c.caracteristica}. {c.nombre}</option>)}
        </select>
      </div>
      <ChartCard titulo={`%IP oficial por docente · Promoción ${cohorte}`} subtitulo={`${tituloMetrica} · color fijo por categoría de desempeño`} altura="h-72"
        tabla={{ columnas: [{ clave: 'docente', titulo: 'Docente' }, { clave: 'valor', titulo: '%IP oficial', formato: ip }, { clave: 'sigla', titulo: 'Categoría' }], filas }}>
        <GraficoBarras datos={filas} ejeX="docente" dominio={[0, 100]} formato={ip} formatoEje={ejePct}
          series={[{ clave: 'valor', nombre: `%IP (${tituloMetrica})`, colorPorDato: (f) => COLOR_CATEGORIA[f.sigla] ?? colorDePct(f.valor) }]} />
      </ChartCard>
    </div>
  )
}

export default function ResultadosEvaluacionPage() {
  const periodos = useApi(evalApi.listarPeriodos)
  const conDatos = (periodos.data ?? []).filter((p) => p.avance.ee.posgrado.recibidas + p.avance.ee.pregrado.recibidas > 0 || p.publicado)
  const [periodo, setPeriodo] = useState('')
  const [poblacion, setPoblacion] = useState('todas')
  const [cohorte, setCohorte] = useState('')
  const [detalle, setDetalle] = useState(null)

  useEffect(() => {
    if (!periodo && conDatos.length) setPeriodo(conDatos[0].periodo)
  }, [periodo, conDatos])

  const res = useApi(() => (periodo ? evalApi.resultados({ periodo, poblacion }) : Promise.resolve({ data: null })), [periodo, poblacion])
  const d = res.data
  const promociones = d?.promociones ?? []
  const visibles = cohorte ? promociones.filter((p) => String(p.id_cohorte) === cohorte) : promociones
  const caracteristicas = d?.programa.idsc ?? []

  const idsc = useMemo(() => caracteristicas.map((c) => ({
    caracteristica: `C${c.caracteristica}`, nombre: c.nombre, idsc: pct100(c.valor),
    promedio: d.programa.promedio_ip.find((x) => x.caracteristica === c.caracteristica)?.promedio ?? null,
  })), [caracteristicas, d])

  const historico = (d?.historico ?? []).map((h) => ({
    periodo: h.periodo, variable: pct100(h.idst_p.por_variable), caracteristica: pct100(h.idst_p.por_caracteristica),
    ...Object.fromEntries(h.promedio_ip.map((c) => [`c${c.caracteristica}`, c.promedio])),
  }))

  return (
    <div className="flex min-w-0 flex-col gap-space-lg">
      <Encabezado icono="insights" titulo="Resultados de desempeño docente">
        Consolidado oficial del semestre por docente, promoción y programa (Art. 12 del Acuerdo 058 de 2022), con su variación histórica.
        Las fuentes EE, EC y AE se presentan por separado (el Acuerdo no define ponderación entre fuentes).
      </Encabezado>

      <Seccion>
        <div className="flex flex-wrap items-end gap-space-sm">
          <Selector etiqueta="Semestre académico" valor={periodo} onChange={(v) => { setPeriodo(v); setCohorte('') }}
            opciones={conDatos.length ? conDatos.map((p) => ({ valor: p.periodo, etiqueta: `${p.periodo}${p.publicado ? ' · publicado' : ''}` })) : [{ valor: '', etiqueta: 'Sin resultados' }]} />
          <Selector etiqueta="Estudiantes" valor={poblacion} onChange={setPoblacion}
            opciones={Object.entries(ETIQUETA_POBLACION).map(([valor, etiqueta]) => ({ valor, etiqueta }))} />
          <Selector etiqueta="Promoción" valor={cohorte} onChange={setCohorte}
            opciones={[{ valor: '', etiqueta: 'Todas' }, ...promociones.map((p) => ({ valor: String(p.id_cohorte), etiqueta: `Promoción ${p.cohorte}` }))]} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-secundario" disabled={!d} onClick={() => evalApi.exportarResultados({ periodo, poblacion })}>
              <Icono nombre="table_view" className="text-[18px]" /> Excel
            </button>
            <button type="button" className="btn btn-primario" disabled={!d} onClick={() => evalApi.informePdf({ periodo, poblacion })}>
              <Icono nombre="picture_as_pdf" className="text-[18px]" /> Informe PDF
            </button>
          </div>
        </div>
        <ErrorApi error={periodos.error ?? res.error} />
        {!periodos.cargando && !conDatos.length && <p className="texto-suave">Aún no hay respuestas de evaluación docente.</p>}
      </Seccion>

      {res.cargando && periodo ? <Cargando /> : d && (
        <>
          <div className="grid gap-space-md sm:grid-cols-2 xl:grid-cols-3">
            <TarjetaKpi etiqueta="Docentes evaluados (EE)" valor={d.programa.docentes} icono="groups">
              <Insignia>{d.programa.respuestas_ee} respuestas{d.programa.excluidas ? ` · ${d.programa.excluidas} extremas excluidas` : ''}</Insignia>
            </TarjetaKpi>
            <TarjetaKpi etiqueta="IDST-P por variable (Acuerdo 058)" valor={proporcion(d.programa.idst_p.por_variable)} icono="verified" destacado>
              <BarraProgreso fraccion={d.programa.idst_p.por_variable} />
              <p className="m-0 mt-1 text-body-sm text-on-surface-variant">Meta: {d.configuracion.meta_pct} % de calificaciones GF o F</p>
            </TarjetaKpi>
            <TarjetaKpi etiqueta="IDST-P por característica" valor={proporcion(d.programa.idst_p.por_caracteristica)} icono="category">
              <BarraProgreso fraccion={d.programa.idst_p.por_caracteristica} />
            </TarjetaKpi>
          </div>

          <Seccion>
            <LeyendaCategorias />
          </Seccion>

          <div className="grid gap-space-md xl:grid-cols-2 [&>*]:min-w-0">
            <ChartCard titulo="Indicadores por característica del programa"
              subtitulo="IDSC-Prog = docentes con GF o F / evaluados; Promedio %IP coloreado según categoría de desempeño"
              tabla={{ columnas: [{ clave: 'caracteristica', titulo: 'Característica' }, { clave: 'nombre', titulo: 'Nombre' }, { clave: 'idsc', titulo: 'IDSC-Prog', formato: ip }, { clave: 'promedio', titulo: 'Promedio %IP oficial', formato: ip }], filas: idsc }}>
              <GraficoBarras datos={idsc} ejeX="caracteristica" dominio={[0, 100]} formato={ip} formatoEje={ejePct} referencia={{ valor: d.configuracion.meta_pct, etiqueta: `Meta ${d.configuracion.meta_pct} %` }}
                series={[
                  { clave: 'idsc', nombre: 'IDSC-Prog (Acuerdo 058)', color: '#040039' },
                  { clave: 'promedio', nombre: 'Promedio %IP oficial (por categoría)', colorPorDato: (f) => colorDePct(f.promedio) },
                ]} />
            </ChartCard>
            <ChartCard titulo="Variación histórica del IDST-P" subtitulo="Semestres con respuestas; el del semestre es el promedio de sus promociones"
              tabla={{ columnas: [{ clave: 'periodo', titulo: 'Semestre' }, { clave: 'variable', titulo: 'Por variable', formato: ip }, { clave: 'caracteristica', titulo: 'Por característica', formato: ip }], filas: historico }}>
              <GraficoLineas datos={historico} ejeX="periodo" dominio={[0, 100]} formato={ip} formatoEje={ejePct} referencia={{ valor: d.configuracion.meta_pct, etiqueta: 'Meta' }}
                series={[{ clave: 'variable', nombre: 'IDST-P por variable (Acuerdo 058)', color: '#040039' }, { clave: 'caracteristica', nombre: 'IDST-P por característica', color: '#2a78d6' }]} />
            </ChartCard>
          </div>
          <ChartCard titulo="Promedio del %IP oficial por característica, por semestre" subtitulo="Variación histórica de cada característica (C1–C6) en el programa"
            tabla={{ columnas: [{ clave: 'periodo', titulo: 'Semestre' }, ...caracteristicas.map((c) => ({ clave: `c${c.caracteristica}`, titulo: `C${c.caracteristica}`, formato: ip }))], filas: historico }}>
            <GraficoLineas datos={historico} ejeX="periodo" dominio={[0, 100]} formato={ip} formatoEje={ejePct}
              series={caracteristicas.map((c) => ({ clave: `c${c.caracteristica}`, nombre: `C${c.caracteristica}. ${c.nombre}` }))} />
          </ChartCard>

          {visibles.map((p) => {
            const unidades = d.unidades.filter((u) => u.id_cohorte === p.id_cohorte && (u.ee || u.ec || u.ae))
            const ks = p.idsc.map((c) => c.caracteristica)
            return (
              <Seccion key={p.id_cohorte}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="m-0 font-display text-headline-sm text-primary">Promoción {p.cohorte}</h2>
                  <span className="text-body-sm text-on-surface-variant">
                    IDST-P: {proporcion(p.idst_p.por_variable)} por variable · {proporcion(p.idst_p.por_caracteristica)} por característica
                  </span>
                </div>
                <LeyendaCategorias />
                <div className="tabla-scroll">
                  <table className="text-body-sm">
                    <thead>
                      <tr>
                        <th>Docente</th><th className="num">EE</th>
                        {ks.map((k) => <th key={k}>C{k}</th>)}
                        <th className="num">IDST-D variable</th><th className="num">IDST-D caract.</th>
                        <th>EC</th><th>AE</th><th><span className="sr-only">Detalle</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {unidades.map((u) => (
                        <tr key={u.id_docente}>
                          <td><span className="font-semibold">{u.docente}</span>{u.afiliacion && <span className="block text-on-surface-variant">{u.afiliacion === 'UDENAR' ? 'UDENAR' : 'Externo'}</span>}</td>
                          <td className="num" title={`Posgrado ${u.poblaciones.posgrado} · pregrado ${u.poblaciones.pregrado}`}>{u.ee?.respuestas ?? 0}</td>
                          {ks.map((k) => {
                            const c = u.ee?.caracteristicas.find((x) => x.caracteristica === k)
                            return <td key={k}>{c ? <CategoriaInsignia sigla={c.sigla} valor={c.pct_ip} compacta /> : '—'}</td>
                          })}
                          <td className="num">{proporcion(u.ee?.idst_d.por_variable.valor)}</td>
                          <td className="num">{proporcion(u.ee?.idst_d.por_caracteristica.valor)}</td>
                          <td>{u.ec ? <CategoriaInsignia sigla={u.ec.global.sigla} valor={u.ec.global.pct_ip} compacta /> : 'Pendiente'}</td>
                          <td>{u.ae ? <CategoriaInsignia sigla={u.ae.global.sigla} valor={u.ae.global.pct_ip} compacta /> : 'Pendiente'}</td>
                          <td className="acciones"><button type="button" className="btn btn-secundario" onClick={() => setDetalle({ ...u, periodo })}>Detalle</button></td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td>IDSC-Prom (Acuerdo)</td><td />
                        {ks.map((k) => <td key={k}>{proporcion(p.idsc.find((c) => c.caracteristica === k)?.valor)}</td>)}
                        <td colSpan={5} />
                      </tr>
                      <tr className="texto-suave">
                        <td>Promedio %IP oficial</td><td />
                        {ks.map((k) => <td key={k}>{ip(p.promedio_ip.find((c) => c.caracteristica === k)?.promedio)}</td>)}
                        <td colSpan={5} />
                      </tr>
                    </tbody>
                  </table>
                </div>
                <GraficoPromocion cohorte={p.cohorte} unidades={unidades} caracteristicas={p.idsc} />
              </Seccion>
            )
          })}
        </>
      )}

      {detalle && (
        <Modal titulo={`${detalle.docente} · Promoción ${detalle.cohorte} · ${detalle.periodo}`} onClose={() => setDetalle(null)} ancho={980}>
          <div className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto">
            <button type="button" className="btn btn-secundario self-start" onClick={() => evalApi.informeDocentePdf(detalle.id_docente)}>
              <Icono nombre="picture_as_pdf" className="text-[18px]" /> Informe PDF del docente (con histórico)
            </button>
            <DetalleUnidad unidad={detalle} />
          </div>
        </Modal>
      )}
    </div>
  )
}
