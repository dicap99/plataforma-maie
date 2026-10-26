import Icono from '../../../components/common/Icono.jsx'
import { LINEAS_INVESTIGACION } from '../../../config/institucional'
import { numero } from '../../../utils/formato'

function Bloque({ icono, titulo, descripcion, lineas }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-space-md">
      <h3 className="flex items-center gap-2 font-display text-headline-sm text-primary">
        <Icono nombre={icono} className="text-[20px] text-secondary" />
        {titulo}
      </h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">{descripcion}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {lineas.map((linea) => (
          <li
            key={linea}
            className="rounded-full bg-surface-container-lowest px-3 py-1 text-label-md font-semibold text-primary shadow-sm"
          >
            {linea}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Líneas de investigación del programa (fijas, ver config/institucional.js). Como dato de apoyo se
// muestran los campos de formación de la planta docente registrada (RF-ADM-06).
export default function LineasInvestigacion({ docentes }) {
  const campos = docentes.porCampo ?? []

  return (
    <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
        <Icono nombre="hub" className="text-[16px]" />
        Áreas de enfoque curricular
      </div>
      <h2 className="mt-1 font-display text-headline-md text-primary">Líneas de investigación y desarrollo</h2>

      <div className="mt-space-md grid grid-cols-1 gap-space-md lg:grid-cols-2">
        <Bloque
          icono="precision_manufacturing"
          titulo="Líneas principales"
          descripcion="Ejes de profundización del plan de estudios y de los trabajos de grado."
          lineas={LINEAS_INVESTIGACION.principales}
        />
        <Bloque
          icono="smart_toy"
          titulo="Líneas transversales"
          descripcion="Áreas de apoyo que atraviesan las líneas principales."
          lineas={LINEAS_INVESTIGACION.transversales}
        />
      </div>

      {campos.length > 0 && (
        <div className="mt-space-md">
          <p className="text-body-sm text-on-surface-variant">
            Campos de formación de los {numero(docentes.total)} docentes vinculados ({numero(docentes.udenar)} UDENAR ·{' '}
            {numero(docentes.externos)} externos). El número indica cuántos docentes cubren cada campo.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {campos.map((c) => (
              <li
                key={c.campo}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1 text-label-sm text-on-surface"
              >
                {c.campo}
                <span className="rounded-full bg-secondary-fixed px-1.5 text-label-sm font-bold text-on-secondary-fixed-variant">
                  {numero(c.cantidad)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
