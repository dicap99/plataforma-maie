import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import RecursoTabla from './RecursoTabla.jsx'
import CsvUploaderModal from './CsvUploaderModal.jsx'
import BeneficiosPanel from './beneficios/BeneficiosPanel.jsx'
import InvestigacionMovilidadPanel from './InvestigacionMovilidadPanel.jsx'
import ContratacionesOpsPanel from './ContratacionesOpsPanel.jsx'
import MatriculasFinancierasPanel from './finanzas/MatriculasFinancierasPanel.jsx'

// Hojas de cada grupo, en orden. «parametros» es financiera en el backend, pero se muestra primero entre las
// académicas (decisión del usuario, 2026-11-24). «beneficios-detalle» no es una hoja del libro: es el registro
// por estudiante y semestre (becas, asistencias y ayudantías), del que se calculan los totales de «Beneficios».
const GRUPOS = [
  { id: 'academicas', titulo: 'Académicas', categoria: 'academico', orden: ['parametros', 'cohortes', 'docentes', 'beneficios-detalle', 'investigacion'] },
  // En el orden de las pestañas de Presupuesto y finanzas.
  { id: 'financieras', titulo: 'Financieras', categoria: 'financiero', orden: ['presupuesto', 'punto-equilibrio', 'matriculas-financieras', 'pregrado', 'transferencias', 'contratos-ops'] },
]
const MOVIDAS_A_ACADEMICAS = new Set(['parametros'])
const BENEFICIOS_DETALLE = { id: 'beneficios-detalle', titulo: 'Beneficios' }
const MATRICULAS_FIN = { id: 'matriculas-financieras', titulo: 'Matrícula financiera' }
// Artículos, ponencias, software, prototipos y tesis (productos) y pasantías, en una sola entrada (decisión del
// usuario, 2026-11-24). Los totales de «Producción científica» se calculan de los productos registrados.
const INVESTIGACION = { id: 'investigacion', titulo: 'Investigación y movilidad' }
// Hojas anteriores que ahora se editan dentro de «Investigación y movilidad» (?hoja= de enlaces previos).
const A_INVESTIGACION = { produccion: 'articulos', productos: 'articulos', pasantias: 'pasantias', 'pasantias-detalle': 'pasantias' }
const posicion = (orden, id) => (orden.includes(id) ? orden.indexOf(id) : Infinity)

// Datos del programa (RF-ADM-01 a RF-ADM-06), pestaña de Gestión académica: el único lugar donde se editan
// las hojas del libro «Estadísticas MaIE», con la importación y exportación del Excel. Información académica
// y Presupuesto y finanzas solo las consultan (su botón «Editar» trae aquí con ?hoja=<id>).
//  - Las hojas calculadas (p. ej. «Cursos y docentes por semestre») no aparecen: se consultan en Información
//    académica, que muestra la cifra calculada.
//  - La hoja «Beneficios» (totales por promoción) tampoco: se calcula del detalle por estudiante y semestre,
//    que se registra en «Beneficios» de este mismo grupo (decisión del usuario, 2026-11-24).
// «Contrataciones OPS» se edita con todo el detalle de cada contrato (hoja «contratos-ops», acordado en la
// reunión del 20-oct); los totales por periodo («contrataciones») se calculan de ahí y se consultan en
// Presupuesto y finanzas (decisión del usuario, 2026-11-24).
const OCULTAS = new Set(['beneficios', 'produccion', 'productos', 'pasantias', 'pasantias-detalle', 'contrataciones'])
const TITULOS = { 'contratos-ops': 'Contrataciones OPS' }
const REDIRIGIDAS = { contrataciones: 'contratos-ops' }

export default function DatosDelPrograma() {
  const recursos = useApi(adminApi.listarRecursos)
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const [parametros] = useSearchParams()
  const hojaUrl = parametros.get('hoja')
  const [activo, setActivo] = useState(A_INVESTIGACION[hojaUrl] ? INVESTIGACION.id : REDIRIGIDAS[hojaUrl] ?? hojaUrl ?? 'parametros')
  const apartadoInicial = parametros.get('apartado') ?? A_INVESTIGACION[hojaUrl]
  const [importando, setImportando] = useState(false)
  const [version, setVersion] = useState(0)

  if (recursos.cargando && !recursos.data) return <Cargando />
  if (recursos.error) return <ErrorApi error={recursos.error} onReintentar={recursos.recargar} />
  const lista = (recursos.data ?? []).filter((r) => r.editable && !OCULTAS.has(r.id)).map((r) => (TITULOS[r.id] ? { ...r, titulo: TITULOS[r.id] } : r))
  const grupoDe = (r) => (MOVIDAS_A_ACADEMICAS.has(r.id) ? 'academico' : r.categoria)
  const grupos = GRUPOS.map((g) => ({
    ...g,
    hojas: [
      ...lista.filter((r) => grupoDe(r) === g.categoria),
      ...(g.id === 'academicas' ? [BENEFICIOS_DETALLE, INVESTIGACION] : []),
      ...(g.id === 'financieras' ? [MATRICULAS_FIN] : []),
    ].sort((a, b) => posicion(g.orden, a.id) - posicion(g.orden, b.id)),
  }))
  const todas = grupos.flatMap((g) => g.hojas)
  const hoja = todas.find((r) => r.id === activo) ?? todas[0]
  if (!hoja) return <p className="texto-suave">No hay hojas disponibles para su rol.</p>

  return (
    <section className="flex flex-col gap-space-md">
      <div className="flex flex-col justify-between gap-space-sm md:flex-row md:items-start">
        <p className="m-0 max-w-3xl text-body-sm text-on-surface-variant">
          Registro de las hojas del libro «Estadísticas MaIE». Lo que se registra en Usuarios, en Beneficios y en la
          asignación por semestre (estudiantes, becas, docentes y materias) se refleja automáticamente en Información
          académica; estas hojas guardan el resto y el histórico de las promociones anteriores.
        </p>
        <div className="flex shrink-0 flex-wrap gap-space-sm">
          <button type="button" className="btn btn-secundario" onClick={() => adminApi.descargarPlantilla(true)}>
            <Icono nombre="file_download" className="text-[18px]" /> Exportar a Excel
          </button>
          <button type="button" className="btn btn-primario" onClick={() => setImportando(true)}>
            <Icono nombre="upload_file" className="text-[18px]" /> Importar Excel/CSV
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        {grupos.filter((g) => g.hojas.length).map((g) => (
          <div key={g.id} className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-label-sm font-bold uppercase tracking-wider text-outline">{g.titulo}</span>
            {g.hojas.map((r) => (
              <button key={r.id} type="button" onClick={() => setActivo(r.id)} aria-pressed={r.id === hoja.id}
                className={`rounded-full px-3 py-1 text-label-md transition-colors ${
                  r.id === hoja.id ? 'bg-secondary text-on-secondary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>
                {r.titulo}
              </button>
            ))}
          </div>
        ))}
      </div>

      {hoja.id === BENEFICIOS_DETALLE.id ? (
        <BeneficiosPanel key={version} />
      ) : hoja.id === MATRICULAS_FIN.id ? (
        <MatriculasFinancierasPanel key={version} cohortes={cohortes.data ?? []} />
      ) : hoja.id === 'contratos-ops' ? (
        <ContratacionesOpsPanel key={version} recurso={hoja} cohortes={cohortes.data ?? []} />
      ) : hoja.id === INVESTIGACION.id ? (
        <InvestigacionMovilidadPanel key={version} recursos={recursos.data ?? []} cohortes={cohortes.data ?? []} apartadoInicial={apartadoInicial} />
      ) : (
        <RecursoTabla
          key={`${hoja.id}-${version}`}
          recurso={hoja}
          cohortes={cohortes.data ?? []}
          onCambio={hoja.id === 'cohortes' ? cohortes.recargar : undefined}
        />
      )}

      {importando && (
        <CsvUploaderModal
          recursos={lista.filter((r) => r.id !== 'parametros')}
          onClose={() => setImportando(false)}
          onImportado={() => {
            cohortes.recargar()
            setVersion((v) => v + 1)
          }}
        />
      )}
    </section>
  )
}
