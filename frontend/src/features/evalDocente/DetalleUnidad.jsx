import { useState } from 'react'
import ChartCard from '../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../components/charts/GraficoBarras.jsx'
import { CategoriaInsignia, ETIQUETA_FORMULARIO, ip, proporcion, REFERENCIA_EXCEL, ejePct } from './comun.jsx'

// Resultado de un docente en una promoción y semestre: EE, EC y AE POR SEPARADO (el Acuerdo 058 no define
// cómo combinarlos). Para cada característica, el %IP oficial (Acuerdo) y, como referencia, el del método
// del Excel de Coordinación con su diferencia. IDST-D por variable y por característica, lado a lado.
function Fuente({ tipo, r }) {
  const [verVariables, setVerVariables] = useState(false)
  if (!r) {
    return (
      <div className="rounded-xl border border-outline-variant p-space-md">
        <h4 className="m-0 font-display text-body-lg text-primary">{ETIQUETA_FORMULARIO[tipo]}</h4>
        <p className="m-0 text-body-sm text-on-surface-variant">Sin diligenciar.</p>
      </div>
    )
  }
  const caracteristicas = r.caracteristicas.filter((c) => c.cuenta_docente)
  const otras = r.caracteristicas.filter((c) => !c.cuenta_docente)
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-outline-variant p-space-md">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="m-0 font-display text-body-lg text-primary">{ETIQUETA_FORMULARIO[tipo]}</h4>
        <span className="text-body-sm text-on-surface-variant">
          {tipo === 'EE' ? `${r.respuestas} respuesta(s)${r.excluidas ? ` · ${r.excluidas} extrema(s) excluida(s)` : ''} · ` : ''}
          Global: <CategoriaInsignia sigla={r.global.sigla} valor={r.global.pct_ip} />
        </span>
      </div>
      <div className="tabla-scroll">
        <table className="text-body-sm">
          <thead>
            <tr><th>Característica</th><th>Oficial (Acuerdo 058)</th><th className="num">MA</th><th className="num">A</th><th className="num">I</th><th className="num">MI</th><th className="num">NA</th>
              <th title={REFERENCIA_EXCEL}>Método Excel (ref.)</th><th className="num">Diferencia</th></tr>
          </thead>
          <tbody>
            {caracteristicas.map((c) => (
              <tr key={c.caracteristica}>
                <td>C{c.caracteristica}. {c.nombre}</td>
                <td><CategoriaInsignia sigla={c.sigla} valor={c.pct_ip} /></td>
                {['MA', 'A', 'I', 'MI', 'NA'].map((v) => <td key={v} className="num">{c.conteos[v]}</td>)}
                <td className="texto-suave">{ip(c.excel.pct_ip)} {c.excel.sigla ?? ''}</td>
                <td className="num texto-suave">{c.excel.diferencia === null ? '—' : `${c.excel.diferencia > 0 ? '+' : ''}${c.excel.diferencia.toFixed(1).replace('.', ',')}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="m-0 grid gap-2 text-body-sm sm:grid-cols-3">
        <div><dt className="text-on-surface-variant">IDST-D por variable (Acuerdo)</dt><dd className="m-0 font-semibold">{proporcion(r.idst_d.por_variable.valor)} <span className="font-normal text-on-surface-variant">({r.idst_d.por_variable.satisfactorias}/{r.idst_d.por_variable.total})</span></dd></div>
        <div><dt className="text-on-surface-variant">IDST-D por característica</dt><dd className="m-0 font-semibold">{proporcion(r.idst_d.por_caracteristica.valor)} <span className="font-normal text-on-surface-variant">({r.idst_d.por_caracteristica.satisfactorias}/{r.idst_d.por_caracteristica.total})</span></dd></div>
        <div><dt className="text-on-surface-variant">IDST-D método Excel (ref.)</dt><dd className="m-0 font-semibold">{proporcion(r.idst_d.excel.valor)}</dd></div>
        <div><dt className="text-on-surface-variant">Promedio y desviación (%IP por variable)</dt><dd className="m-0">{ip(r.estadistica.promedio)} ± {ip(r.estadistica.desviacion)}</dd></div>
        <div><dt className="text-on-surface-variant">Mejor calificada</dt><dd className="m-0">{r.estadistica.mejor ? `${r.estadistica.mejor.codigo} (${ip(r.estadistica.mejor.pct_ip)})` : '—'}</dd></div>
        <div><dt className="text-on-surface-variant">Peor calificada</dt><dd className="m-0">{r.estadistica.peor ? `${r.estadistica.peor.codigo} (${ip(r.estadistica.peor.pct_ip)})` : '—'}</dd></div>
      </dl>
      {otras.map((c) => (
        <p key={c.caracteristica} className="m-0 text-body-sm text-on-surface-variant">
          C{c.caracteristica}. {c.nombre} (no cuenta para el docente): {ip(c.pct_ip)}.
        </p>
      ))}
      <button type="button" className="self-start text-body-sm font-semibold text-secondary" onClick={() => setVerVariables((v) => !v)} aria-expanded={verVariables}>
        {verVariables ? 'Ocultar' : 'Ver'} resultado por variable
      </button>
      {verVariables && (
        <div className="tabla-scroll">
          <table className="text-body-sm">
            <thead><tr><th>Variable</th><th className="num">MA</th><th className="num">A</th><th className="num">I</th><th className="num">MI</th><th className="num">NA</th><th>%IP oficial</th></tr></thead>
            <tbody>
              {r.variables.map((v) => (
                <tr key={v.id_pregunta}>
                  <td><strong>{v.codigo}</strong> {v.texto}</td>
                  {['MA', 'A', 'I', 'MI', 'NA'].map((x) => <td key={x} className="num">{v.conteos[x]}</td>)}
                  <td><CategoriaInsignia sigla={v.sigla} valor={v.pct_ip} compacta /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {r.comentarios.length > 0 && (
        <div>
          <p className="m-0 text-body-sm font-semibold text-on-surface-variant">Opiniones y sugerencias{tipo === 'EE' ? ' (anónimas)' : ''}</p>
          <ul className="m-0 mt-1 flex flex-col gap-1 pl-5 text-body-sm">{r.comentarios.map((c, i) => <li key={i}>«{c}»</li>)}</ul>
        </div>
      )}
    </div>
  )
}

export default function DetalleUnidad({ unidad }) {
  const datos = (unidad.ee?.caracteristicas ?? []).filter((c) => c.cuenta_docente).map((c) => ({
    caracteristica: `C${c.caracteristica}`, oficial: c.pct_ip, excel: c.excel.pct_ip,
  }))
  return (
    <div className="flex flex-col gap-space-md">
      {datos.length > 0 && (
        <ChartCard titulo="%IP por característica (EE)" subtitulo={`Oficial (Acuerdo 058) y ${REFERENCIA_EXCEL.toLowerCase()}`} altura="h-60"
          tabla={{ columnas: [{ clave: 'caracteristica', titulo: 'Característica' }, { clave: 'oficial', titulo: '%IP oficial', formato: ip }, { clave: 'excel', titulo: '%IP método Excel', formato: ip }], filas: datos }}>
          <GraficoBarras datos={datos} ejeX="caracteristica" dominio={[0, 100]} formato={ip} formatoEje={ejePct}
            series={[{ clave: 'oficial', nombre: '%IP oficial (Acuerdo)' }, { clave: 'excel', nombre: '%IP método Excel (ref.)' }]} />
        </ChartCard>
      )}
      <Fuente tipo="EE" r={unidad.ee} />
      <div className="grid gap-space-md lg:grid-cols-2">
        <Fuente tipo="EC" r={unidad.ec} />
        <Fuente tipo="AE" r={unidad.ae} />
      </div>
    </div>
  )
}
