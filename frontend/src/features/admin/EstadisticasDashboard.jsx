import { Link } from 'react-router-dom'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import { numero, pesosCompactos, porcentaje } from '../../utils/formato'
import { periodoAcademico } from '../../utils/periodo'
import BannerPrograma from './panel/BannerPrograma.jsx'
import LineasInvestigacion from './panel/LineasInvestigacion.jsx'
import PanelAlertas from './panel/PanelAlertas.jsx'
import TarjetaKpi, { BarraProgreso, Insignia } from './panel/TarjetaKpi.jsx'

// Panel de gestión del coordinador (RF-ADM-05). Toda la información proviene de
// /admin/reportes/estadisticas: aquí no hay cifras fijas en el código.
export default function EstadisticasDashboard() {
  const { data, error, cargando, recargar } = useApi(adminApi.estadisticas)

  if (cargando && !data) return <Cargando texto="Calculando estadísticas…" />
  if (error) return <ErrorApi error={error} onReintentar={recargar} />

  const { promociones, presupuesto, docentes, alertas } = data

  if (promociones.filas.length === 0) {
    return (
      <div className="card">
        <h1>Panel general</h1>
        <p>Aún no hay datos. Regístrelos en <Link to="gestion?pestana=datos">Gestión académica › Datos del programa</Link>.</p>
      </div>
    )
  }

  // --- Cifras de cabecera -------------------------------------------------
  const ultima = promociones.filas.at(-1)
  const anterior = promociones.filas.at(-2)
  const deltaMatriculados = anterior?.matriculados
    ? (ultima.matriculados - anterior.matriculados) / anterior.matriculados
    : null

  return (
    <div className="flex flex-col gap-space-lg">
      <BannerPrograma
        descripcion={`Panel de gestión del coordinador · Seguimiento de promociones, ejecución presupuestal, planta docente y producción científica · Periodo ${periodoAcademico()}.`}
        metadatos={[
          {
            icono: 'school',
            etiqueta: 'Promociones',
            valor: `${numero(promociones.filas.length)} · vigente ${ultima.nombre}`,
          },
          {
            icono: 'groups',
            etiqueta: 'Población estudiantil',
            valor: `${numero(promociones.indicadores.poblacion_total)} estudiantes`,
          },
        ]}
      />

      <PanelAlertas alertas={alertas} />

      <section className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <TarjetaKpi etiqueta="Matriculados al I semestre" valor={numero(promociones.totales.matriculados)} icono="groups">
          <div className="flex items-center justify-between gap-2">
            {deltaMatriculados === null ? (
              <Insignia>{numero(promociones.filas.length)} promociones</Insignia>
            ) : (
              <Insignia>
                <Icono nombre={deltaMatriculados >= 0 ? 'trending_up' : 'trending_down'} className="text-[14px]" />
                {deltaMatriculados >= 0 ? '+' : ''}{porcentaje(deltaMatriculados)}
              </Insignia>
            )}
            <span className="text-label-sm text-on-surface-variant">
              {anterior ? `${ultima.nombre} vs. ${anterior.nombre}` : 'histórico acumulado'}
            </span>
          </div>
        </TarjetaKpi>

        <TarjetaKpi
          etiqueta="Presupuesto ejecutado"
          valor={porcentaje(presupuesto.indicadores.pct_ejecucion)}
          icono="account_balance_wallet"
        >
          <BarraProgreso fraccion={presupuesto.indicadores.pct_ejecucion} />
          <div className="mt-2 flex justify-between gap-2 text-label-sm text-on-surface-variant">
            <span>Comprometido: {pesosCompactos(presupuesto.totales.gastos_comprometidos)}</span>
            <span>Saldo: {pesosCompactos(presupuesto.totales.saldo_comprometido)}</span>
          </div>
        </TarjetaKpi>

        <TarjetaKpi etiqueta="Docentes vinculados" valor={numero(docentes.total)} icono="badge">
          <div className="flex items-center justify-between gap-2">
            <Insignia tono="acento">{numero(docentes.udenar)} UDENAR</Insignia>
            <span className="text-label-sm text-on-surface-variant">{numero(docentes.externos)} externos</span>
          </div>
        </TarjetaKpi>

        <TarjetaKpi
          etiqueta="Titulación"
          valor={porcentaje(promociones.indicadores.pct_titulacion)}
          icono="military_tech"
          destacado
        >
          <div className="flex items-center justify-between gap-2">
            <Insignia tono="fuerte">{numero(promociones.totales.graduados)} graduados</Insignia>
            <span className="text-label-sm text-on-surface-variant">
              {porcentaje(promociones.indicadores.pct_graduados)} de {numero(promociones.totales.egresados)} egresados
            </span>
          </div>
        </TarjetaKpi>

        <TarjetaKpi etiqueta="Deserción" valor={porcentaje(promociones.indicadores.pct_desercion)} icono="person_remove">
          <div className="flex items-center justify-between gap-2">
            <Insignia>{numero(promociones.indicadores.retirados)} retirados</Insignia>
            <span className="text-label-sm text-on-surface-variant">
              promociones egresadas
              {promociones.indicadores.retirados_en_curso ? ` · ${numero(promociones.indicadores.retirados_en_curso)} en curso` : ''}
            </span>
          </div>
        </TarjetaKpi>
      </section>

      {/* Áreas de enfoque curricular. Las gráficas están en Información académica y en Presupuesto y finanzas
          (2026-11-25, decisión del usuario). */}
      <LineasInvestigacion docentes={docentes} />
    </div>
  )
}
