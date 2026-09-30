import Modal from '../../../components/common/Modal.jsx'
import { COLOR_NIVEL } from '../rubrica'
import { NIVELES_CRITERIO } from './comun'

// Descriptores oficiales de la rúbrica del RA (documento RA MaIE, Tablas 5 a 11).
export default function DescriptoresModal({ ra, niveles, onClose }) {
  const altoPrimero = [...NIVELES_CRITERIO].reverse()
  return (
    <Modal titulo={`Descriptores oficiales · Rúbrica ${ra.codigo}`} onClose={onClose} ancho={1040}>
      <div className="flex flex-col gap-space-md">
        <div className="rounded-xl bg-surface-container-low p-space-md">
          <h3 className="text-label-lg font-bold text-primary">Resultado de aprendizaje {ra.codigo}</h3>
          <p className="text-body-md text-on-surface-variant">«{ra.descripcion}»</p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Estrategias sugeridas: {ra.estrategias.join(', ')} · Nivel de dominio esperado: {ra.nivel_dominio}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {altoPrimero.map(({ nivel }) => {
            const n = niveles.find((x) => x.nivel === nivel)
            return (
              <div key={nivel} className="rounded-xl p-space-sm" style={{ backgroundColor: `${COLOR_NIVEL[nivel]}1a` }}>
                <span className="block text-label-md font-bold" style={{ color: COLOR_NIVEL[nivel] }}>{n.etiqueta}</span>
                <span className="text-body-sm text-on-surface-variant">{n.rango}</span>
              </div>
            )
          })}
        </div>

        <div className="tabla-scroll max-h-[55vh]">
          <table className="text-body-sm">
            <thead>
              <tr>
                <th>Criterio</th>
                <th className="num">Peso</th>
                {altoPrimero.map(({ nivel }) => <th key={nivel}>{niveles.find((x) => x.nivel === nivel).etiqueta}</th>)}
              </tr>
            </thead>
            <tbody>
              {ra.criterios.map((c) => (
                <tr key={c.id_criterio}>
                  <td><strong>{c.orden}.</strong> {c.nombre_criterio}</td>
                  <td className="num">{c.peso_porcentaje}%</td>
                  {altoPrimero.map(({ nivel, campo }) => (
                    <td key={nivel} style={{ borderTop: `3px solid ${COLOR_NIVEL[nivel]}` }}>{c[campo]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-body-sm text-on-surface-variant">
          El total del RA es la suma ponderada de las notas de los criterios; el nivel se asigna con los rangos anteriores.
        </p>
        <div className="modal-acciones">
          <button type="button" className="btn btn-primario" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </Modal>
  )
}
