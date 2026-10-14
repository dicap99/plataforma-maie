import ChartCard from '../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../components/charts/GraficoBarras.jsx'
import GraficoDona from '../../components/charts/GraficoDona.jsx'
import { SERIES } from '../../components/charts/paleta'
import { numero, porcentaje } from '../../utils/formato'
import TarjetaKpi, { BarraProgreso, Insignia } from './panel/TarjetaKpi.jsx'
import { FilaIndicadores, RejillaGraficas, SinDatos } from './academico/comunes.jsx'
import { razon } from './academico/estadisticas'

export const ROLES_ETIQUETA = { coordinador: 'Coordinación', docente: 'Docentes', estudiante: 'Estudiantes' }

// Usuarios y roles (RNF-SEG-01): composición por rol, estado de las cuentas y vínculo de los
// docentes con su perfil (RF-ADM-06). Un clic filtra la tabla de «Datos».
export default function PanelUsuarios({ usuarios, onFiltrar }) {
  if (!usuarios.length) return <SinDatos texto="No hay usuarios registrados." />

  const activos = usuarios.filter((u) => u.activo).length
  const docentes = usuarios.filter((u) => u.rol === 'docente')
  const vinculados = docentes.filter((u) => u.id_docente).length
  const porRol = Object.entries(ROLES_ETIQUETA).map(([rol, nombre], i) => {
    const del = usuarios.filter((u) => u.rol === rol)
    return { rol, nombre, valor: del.length, activos: del.filter((u) => u.activo).length, inactivos: del.filter((u) => !u.activo).length, color: SERIES[i] }
  })
  const filtrarRol = (rol, nombre) => onFiltrar({ etiqueta: nombre, fn: (u) => u.rol === rol })
  const vinculo = [
    { nombre: 'Con perfil docente', valor: vinculados, color: SERIES[2] },
    { nombre: 'Sin perfil', valor: docentes.length - vinculados, color: SERIES[3] },
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <FilaIndicadores>
        <TarjetaKpi etiqueta="Usuarios" valor={numero(usuarios.length)} icono="manage_accounts" destacado>
          <Insignia>{porRol.map((r) => `${r.valor} ${r.nombre.toLowerCase()}`).join(' · ')}</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Cuentas activas" valor={porcentaje(razon(activos, usuarios.length))} icono="verified_user">
          <BarraProgreso fraccion={razon(activos, usuarios.length)} />
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Docentes con perfil" valor={`${vinculados} de ${docentes.length}`} icono="badge">
          <BarraProgreso fraccion={razon(vinculados, docentes.length)} />
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Inactivos" valor={numero(usuarios.length - activos)} icono="person_off">
          <Insignia tono="neutro">Sin acceso a la plataforma</Insignia>
        </TarjetaKpi>
      </FilaIndicadores>

      <RejillaGraficas>
        <ChartCard titulo="Usuarios por rol" subtitulo="Clic en un sector para ver esos usuarios"
          tabla={{ columnas: [{ clave: 'nombre', titulo: 'Rol' }, { clave: 'valor', titulo: 'Usuarios', formato: numero }], filas: porRol }}>
          <GraficoDona datos={porRol} formato={numero} etiquetaTotal="usuarios" onSeleccionar={(s) => filtrarRol(s.rol, s.nombre)} />
        </ChartCard>
        <ChartCard titulo="Estado de las cuentas por rol" subtitulo="Clic en una barra para ver ese rol"
          tabla={{ columnas: [{ clave: 'nombre', titulo: 'Rol' }, { clave: 'activos', titulo: 'Activos', formato: numero }, { clave: 'inactivos', titulo: 'Inactivos', formato: numero }], filas: porRol }}>
          <GraficoBarras datos={porRol} ejeX="nombre" apilado formato={numero} onSeleccionar={(r) => filtrarRol(r.rol, r.nombre)}
            series={[{ clave: 'activos', nombre: 'Activos', color: SERIES[2] }, { clave: 'inactivos', nombre: 'Inactivos', color: SERIES[7] }]} />
        </ChartCard>
      </RejillaGraficas>

      {docentes.length > 0 && (
        <RejillaGraficas>
          <ChartCard titulo="Vínculo de los docentes con su perfil" subtitulo="El perfil (hoja «Docentes») guarda su formación y campos"
            tabla={{ columnas: [{ clave: 'nombre', titulo: 'Estado' }, { clave: 'valor', titulo: 'Docentes', formato: numero }], filas: vinculo }}>
            <GraficoDona datos={vinculo} formato={numero} etiquetaTotal="docentes"
              onSeleccionar={(s) => onFiltrar({ etiqueta: `Docentes ${s.nombre.toLowerCase()}`,
                fn: (u) => u.rol === 'docente' && (s.nombre === 'Con perfil docente' ? Boolean(u.id_docente) : !u.id_docente) })} />
          </ChartCard>
        </RejillaGraficas>
      )}
    </div>
  )
}
