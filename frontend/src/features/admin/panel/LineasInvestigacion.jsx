import Icono from '../../../components/common/Icono.jsx'
import { numero } from '../../../utils/formato'

// Umbral que separa las líneas consolidadas de las emergentes: a partir de tres
// docentes un campo sostiene cursos y dirección de tesis por sí solo.
const MINIMO_CONSOLIDADA = 3

function Bloque({ icono, titulo, descripcion, campos }) {
  if (campos.length === 0) return null
  return (
    <div className="rounded-xl bg-surface-container-low p-space-md">
      <h3 className="flex items-center gap-2 font-display text-headline-sm text-primary">
        <Icono nombre={icono} className="text-[20px] text-secondary" />
        {titulo}
      </h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">{descripcion}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {campos.map((c) => (
          <li
            key={c.campo}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-lowest px-3 py-1 text-label-sm text-on-surface shadow-sm"
          >
            {c.campo}
            <span className="rounded-full bg-secondary-fixed px-1.5 text-label-sm font-bold text-on-secondary-fixed-variant">
              {numero(c.cantidad)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Áreas de enfoque curricular a partir del campo de formación registrado en la
// hoja «Docentes UDENAR-EXTERNOS» (RF-ADM-06). No hay catálogo de líneas en la
// base: las líneas se infieren de la planta docente efectivamente vinculada.
export default function LineasInvestigacion({ docentes }) {
  const campos = docentes.porCampo ?? []
  const principales = campos.filter((c) => c.cantidad >= MINIMO_CONSOLIDADA)
  const transversales = campos.filter((c) => c.cantidad < MINIMO_CONSOLIDADA)

  if (campos.length === 0) return null

  return (
    <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
        <Icono nombre="hub" className="text-[16px]" />
        Áreas de enfoque curricular
      </div>
      <h2 className="mt-1 font-display text-headline-md text-primary">Líneas de investigación y desarrollo</h2>
      <p className="text-body-sm text-on-surface-variant">
        Campos de formación de los {numero(docentes.total)} docentes vinculados ({numero(docentes.udenar)} UDENAR ·{' '}
        {numero(docentes.externos)} externos). El número indica cuántos docentes cubren cada campo.
      </p>

      <div className="mt-space-md grid grid-cols-1 gap-space-md lg:grid-cols-2">
        <Bloque
          icono="workspaces"
          titulo="Líneas consolidadas"
          descripcion={`Campos con ${MINIMO_CONSOLIDADA} o más docentes: sostienen cursos y dirección de tesis.`}
          campos={principales}
        />
        <Bloque
          icono="lightbulb"
          titulo="Líneas emergentes"
          descripcion="Campos cubiertos por uno o dos docentes; dependen de contratación externa."
          campos={transversales}
        />
      </div>
    </section>
  )
}
