import { useMemo, useState } from 'react'
import Icono from '../../../components/common/Icono.jsx'

export function calcularMetricasTriangulo(cohortesSeleccionadas) {
  const lista = Array.isArray(cohortesSeleccionadas)
    ? cohortesSeleccionadas
    : [cohortesSeleccionadas]
  const totalMatriculados =
    lista.reduce((acc, c) => acc + (typeof c.matriculados === 'number' ? c.matriculados : 0), 0) || 1

  // Egresados (aprobados sem 4)
  const egresados = lista.reduce(
    (acc, c) => acc + (typeof c.egresados === 'number' ? c.egresados : 0),
    0,
  )
  // Graduados
  const graduados = lista.reduce(
    (acc, c) => acc + (typeof c.graduados === 'number' ? c.graduados : 0),
    0,
  )
  // En curso: promociones que aún no tienen egresados registrados
  const enCurso = lista
    .filter((c) => typeof c.egresados !== 'number')
    .reduce((acc, c) => acc + (typeof c.matriculados === 'number' ? c.matriculados : 0), 0)

  // Retiros reales: para cohortes culminadas, matriculados - egresados
  const culminadas = lista.filter((c) => typeof c.egresados === 'number')
  const retirosReales = culminadas.reduce(
    (acc, c) => acc + Math.max(0, (c.matriculados || 0) - (c.egresados || 0)),
    0,
  )

  const pctEgresados = (egresados / totalMatriculados) * 100
  const pctGraduados = (graduados / totalMatriculados) * 100
  const pctRetiros = (retirosReales / totalMatriculados) * 100
  const pctEnCurso = (enCurso / totalMatriculados) * 100

  return {
    totalMatriculados,
    egresados,
    graduados,
    retirosReales,
    enCurso,
    pctEgresados: Math.round(pctEgresados * 10) / 10,
    pctGraduados: Math.round(pctGraduados * 10) / 10,
    pctRetiros: Math.round(pctRetiros * 10) / 10,
    pctEnCurso: Math.round(pctEnCurso * 10) / 10,
  }
}

export default function DiagramaTriangular({ cohortes = [] }) {
  const [seleccion, setSeleccion] = useState('todas')

  const cohorteActual = useMemo(() => {
    if (seleccion === 'todas') return cohortes
    return cohortes.find((c) => String(c.id_cohorte) === String(seleccion)) ?? cohortes
  }, [cohortes, seleccion])

  const metricas = useMemo(() => calcularMetricasTriangulo(cohorteActual), [cohorteActual])

  // Coordenadas del triángulo equilátero en SVG viewBox 0 0 520 380
  const verticeA = { x: 260, y: 75 } // Top: Egresados
  const verticeB = { x: 70, y: 290 } // Bottom-Left: Retiros
  const verticeC = { x: 450, y: 290 } // Bottom-Right: Graduados

  // Cálculo de coordenadas baricéntricas normalizadas para el punto ● dentro del triángulo
  const posPunto = useMemo(() => {
    const wA = Math.max(0.001, metricas.pctEgresados)
    const wB = Math.max(0.001, metricas.pctRetiros)
    const wC = Math.max(0.001, metricas.pctGraduados)
    const sumW = wA + wB + wC || 1

    const uA = wA / sumW
    const uB = wB / sumW
    const uC = wC / sumW

    return {
      x: uA * verticeA.x + uB * verticeB.x + uC * verticeC.x,
      y: uA * verticeA.y + uB * verticeB.y + uC * verticeC.y,
    }
  }, [metricas, verticeA, verticeB, verticeC])

  // Sub-triángulo interno conectando puntos intermedios hacia el punto central
  const subA = {
    x: verticeA.x * 0.45 + posPunto.x * 0.55,
    y: verticeA.y * 0.45 + posPunto.y * 0.55,
  }
  const subB = {
    x: verticeB.x * 0.45 + posPunto.x * 0.55,
    y: verticeB.y * 0.45 + posPunto.y * 0.55,
  }
  const subC = {
    x: verticeC.x * 0.45 + posPunto.x * 0.55,
    y: verticeC.y * 0.45 + posPunto.y * 0.55,
  }

  const nombreVista =
    seleccion === 'todas'
      ? 'Consolidado del Programa'
      : (Array.isArray(cohorteActual) ? cohorteActual[0]?.nombre : cohorteActual?.nombre) ??
        'Promoción'

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de Promoción o Consolidado */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-600"></span>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Balance Ternario de Eficiencia y Retiros
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-xs text-slate-500 font-medium">
            {nombreVista.startsWith('Promoción') || nombreVista.startsWith('Sintética')
              ? nombreVista
              : `Promoción ${nombreVista}`}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <label htmlFor="select-triangulo-cohorte" className="text-xs text-slate-500 font-medium">
            Filtrar:
          </label>
          <select
            id="select-triangulo-cohorte"
            value={seleccion}
            onChange={(e) => setSeleccion(e.target.value)}
            className="text-xs py-1.5 px-3 rounded-lg border-slate-300 bg-white text-slate-700 font-medium shadow-2xs focus:ring-violet-500 focus:border-violet-500"
          >
            <option value="todas">Todas las promociones (Consolidado)</option>
            {cohortes.map((c) => (
              <option key={c.id_cohorte} value={c.id_cohorte}>
                {c.nombre.startsWith('Sintética') || c.nombre.startsWith('Cohorte')
                  ? c.nombre
                  : `Promoción ${c.nombre}`}{' '}
                ({c.periodo_inicio} - {c.periodo_fin || 'En curso'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Diagrama Visual Triangular SVG */}
      <div className="relative w-full max-w-xl mx-auto py-2">
        <svg
          viewBox="0 0 520 380"
          className="w-full h-auto drop-shadow-xs select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradiente exterior del triángulo */}
            <linearGradient id="gradTriangulo" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.85" />
            </linearGradient>

            {/* Gradiente de relleno sutil */}
            <linearGradient id="gradFondoTriangulo" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f5f3ff" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#ecfdf5" stopOpacity="0.3" />
            </linearGradient>

            {/* Marcadores de flechas en los vértices */}
            <marker id="arrowUp" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <polygon points="3,0 6,6 0,6" fill="#7c3aed" />
            </marker>
            <marker
              id="arrowDownLeft"
              markerWidth="6"
              markerHeight="6"
              refX="3"
              refY="3"
              orient="auto"
            >
              <polygon points="3,6 0,0 6,0" fill="#f43f5e" />
            </marker>
            <marker
              id="arrowDownRight"
              markerWidth="6"
              markerHeight="6"
              refX="3"
              refY="3"
              orient="auto"
            >
              <polygon points="3,6 0,0 6,0" fill="#10b981" />
            </marker>
          </defs>

          {/* Relleno del triángulo principal */}
          <polygon
            points={`${verticeA.x},${verticeA.y} ${verticeB.x},${verticeB.y} ${verticeC.x},${verticeC.y}`}
            fill="url(#gradFondoTriangulo)"
            stroke="#cbd5e1"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Líneas perimetrales destacadas con flechas en los vértices */}
          {/* Lado izquierdo (Retiros a Egresados) */}
          <line
            x1={verticeB.x + 10}
            y1={verticeB.y - 6}
            x2={verticeA.x - 6}
            y2={verticeA.y + 12}
            stroke="#7c3aed"
            strokeWidth="2.5"
          />
          {/* Lado derecho (Egresados a Graduados) */}
          <line
            x1={verticeA.x + 6}
            y1={verticeA.y + 12}
            x2={verticeC.x - 10}
            y2={verticeC.y - 6}
            stroke="#6366f1"
            strokeWidth="2.5"
          />
          {/* Base inferior (Retiros a Graduados) */}
          <line
            x1={verticeB.x + 16}
            y1={verticeB.y}
            x2={verticeC.x - 16}
            y2={verticeC.y}
            stroke="#10b981"
            strokeWidth="2.5"
          />

          {/* Flecha superior (▲) */}
          <path
            d={`M ${verticeA.x} ${verticeA.y - 2} L ${verticeA.x - 6} ${verticeA.y + 10} L ${verticeA.x + 6} ${verticeA.y + 10} Z`}
            fill="#7c3aed"
          />
          {/* Flecha inferior izquierda (▼) */}
          <path
            d={`M ${verticeB.x} ${verticeB.y + 6} L ${verticeB.x - 6} ${verticeB.y - 6} L ${verticeB.x + 6} ${verticeB.y - 6} Z`}
            fill="#f43f5e"
          />
          {/* Flecha inferior derecha (▼) */}
          <path
            d={`M ${verticeC.x} ${verticeC.y + 6} L ${verticeC.x - 6} ${verticeC.y - 6} L ${verticeC.x + 6} ${verticeC.y - 6} Z`}
            fill="#10b981"
          />

          {/* Guías interiores conectando hacia los vértices (como en el diagrama ASCII) */}
          <line
            x1={posPunto.x}
            y1={posPunto.y}
            x2={subA.x}
            y2={subA.y}
            stroke="#8b5cf6"
            strokeWidth="1.8"
            strokeDasharray="3 3"
          />
          <line
            x1={posPunto.x}
            y1={posPunto.y}
            x2={subB.x}
            y2={subB.y}
            stroke="#f43f5e"
            strokeWidth="1.8"
            strokeDasharray="3 3"
          />
          <line
            x1={posPunto.x}
            y1={posPunto.y}
            x2={subC.x}
            y2={subC.y}
            stroke="#10b981"
            strokeWidth="1.8"
            strokeDasharray="3 3"
          />

          {/* Triángulo interior secundario (● ─── ●) */}
          <polygon
            points={`${subA.x},${subA.y} ${subB.x},${subB.y} ${subC.x},${subC.y}`}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.2"
            strokeDasharray="2 2"
          />

          {/* Nodos secundarios en el triángulo interior (●) */}
          <circle cx={subA.x} cy={subA.y} r="3.5" fill="#6366f1" />
          <circle cx={subB.x} cy={subB.y} r="3.5" fill="#f43f5e" />
          <circle cx={subC.x} cy={subC.y} r="3.5" fill="#10b981" />

          {/* Punto baricéntrico principal (● central) */}
          <circle
            cx={posPunto.x}
            cy={posPunto.y}
            r="12"
            fill="#7c3aed"
            fillOpacity="0.18"
            className="animate-pulse"
          />
          <circle
            cx={posPunto.x}
            cy={posPunto.y}
            r="6.5"
            fill="#7c3aed"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <circle cx={posPunto.x} cy={posPunto.y} r="2.5" fill="#ffffff" />
        </svg>

        {/* VÉRTICE SUPERIOR: % Egresados */}
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 flex flex-col items-center bg-white/95 backdrop-blur-xs px-3.5 py-1.5 rounded-xl border border-violet-200 shadow-xs pointer-events-auto"
          title={`Egresados: ${metricas.egresados} de ${metricas.totalMatriculados} matriculados`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 flex items-center gap-1">
            <Icono nombre="school" className="text-[14px] text-violet-600" /> % Egresados
          </span>
          <span className="text-xl font-extrabold text-slate-900 tabular-numbers leading-tight">
            {metricas.pctEgresados}%
          </span>
          <span className="text-[9px] text-slate-400 font-medium">
            {metricas.egresados} culminados
          </span>
        </div>

        {/* VÉRTICE INFERIOR IZQUIERDO: % Retiros Reales */}
        <div
          className="absolute bottom-6 left-0 flex flex-col items-start bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-rose-200 shadow-xs pointer-events-auto max-w-[170px]"
          title={`Retiros reales (deserción): ${metricas.retirosReales} de ${metricas.totalMatriculados}`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
            <Icono nombre="person_remove" className="text-[14px] text-rose-600" /> % Retiros Reales
          </span>
          <span className="text-xl font-extrabold text-slate-900 tabular-numbers leading-tight">
            {metricas.pctRetiros}%
          </span>
          <span className="text-[9px] text-slate-400 font-medium">
            {metricas.retirosReales} retiros acumulados
          </span>
        </div>

        {/* VÉRTICE INFERIOR DERECHO: % Graduados */}
        <div
          className="absolute bottom-6 right-0 flex flex-col items-end bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-emerald-200 shadow-xs pointer-events-auto max-w-[170px]"
          title={`Graduados: ${metricas.graduados} de ${metricas.totalMatriculados}`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
            <Icono nombre="workspace_premium" className="text-[14px] text-emerald-600" /> %
            Graduados
          </span>
          <span className="text-xl font-extrabold text-slate-900 tabular-numbers leading-tight">
            {metricas.pctGraduados}%
          </span>
          <span className="text-[9px] text-slate-400 font-medium">
            {metricas.graduados} graduados
          </span>
        </div>
      </div>

      {/* PIE / DATO CONTEXTUAL: (% En curso: XX%) */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-slate-100">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
          <Icono nombre="pending_actions" className="text-amber-600 text-[15px]" />
          <span>(% En curso: {metricas.pctEnCurso}%)</span>
          <span className="text-amber-700/80 font-normal">
            · {metricas.enCurso} estudiantes activos
          </span>
        </div>
        <span className="text-xs text-slate-400 font-medium">
          Base: {metricas.totalMatriculados} estudiantes matriculados
        </span>
      </div>
    </div>
  )
}
