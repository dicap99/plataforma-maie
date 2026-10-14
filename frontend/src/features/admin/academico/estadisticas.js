// Cálculos de «Información académica» a partir de las filas de cada hoja. Replican las fórmulas de
// backend/src/modules/admin/reportes/estadisticas.js (población de referencia, tasas, campos de
// formación) para que las gráficas también funcionen con el rol docente, que no consulta ese reporte.

export const razon = (a, b) => (typeof a === 'number' && typeof b === 'number' && b !== 0 ? a / b : null)
const esNumero = (v) => typeof v === 'number' && Number.isFinite(v)
export const suma = (valores) => valores.filter(esNumero).reduce((a, b) => a + b, 0)

// Población de referencia de una promoción: el último corte con dato (como en el backend).
export const poblacionReferencia = (c) =>
  [c.egresados, c.aprobados_sem3, c.aprobados_sem2, c.aprobados_sem1, c.matriculados].find(esNumero) ?? null

export const ordenarCohortes = (cohortes) => [...cohortes].sort((a, b) => (a.periodo_inicio < b.periodo_inicio ? -1 : 1))

// Etapas del recorrido de una promoción (curva de permanencia y embudo).
export const ETAPAS = [
  { clave: 'inscritos', nombre: 'Inscritos' },
  { clave: 'matriculados', nombre: 'Matriculados' },
  { clave: 'aprobados_sem1', nombre: 'Aprobados I' },
  { clave: 'aprobados_sem2', nombre: 'Aprobados II' },
  { clave: 'aprobados_sem3', nombre: 'Aprobados III' },
  { clave: 'egresados', nombre: 'Egresados' },
  { clave: 'graduados', nombre: 'Graduados' },
]

export const indicadoresPromociones = (cohortes) => {
  // Las tasas globales solo consideran promociones que ya egresaron.
  const egresadas = cohortes.filter((c) => esNumero(c.egresados))
  return {
    matriculados: suma(cohortes.map((c) => c.matriculados)),
    tasaEgreso: razon(suma(egresadas.map((c) => c.egresados)), suma(egresadas.map((c) => c.matriculados))),
    tasaGraduacion: razon(suma(egresadas.map((c) => c.graduados)), suma(egresadas.map((c) => c.egresados))),
    enCurso: cohortes.length - egresadas.length,
  }
}

// Campos de formación de los docentes (texto libre con varios campos por docente).
export const camposDeFormacion = (texto) =>
  String(texto ?? 'Sin registrar')
    .split(/\n|,|\s-\s|\+/)
    .map((c) => c.replace(/^[-•\s]+/, '').trim())
    .filter(Boolean)

export const docentesPorCampo = (docentes) => {
  const conteo = new Map()
  for (const d of docentes) for (const c of camposDeFormacion(d.campo_formacion)) conteo.set(c, (conteo.get(c) ?? 0) + 1)
  return [...conteo.entries()].map(([campo, cantidad]) => ({ campo, cantidad })).sort((a, b) => b.cantidad - a.cantidad)
}

// Une las filas por promoción con su nombre, orden y población de referencia; deja fuera las
// promociones que no están en `cohortes` (p. ej. excluidas por el filtro de rango).
export const porCohorte = (filas, cohortes) => {
  const info = new Map(cohortes.map((c, i) => [c.id_cohorte, { orden: i, nombre: c.nombre, poblacion: poblacionReferencia(c) }]))
  return filas
    .filter((f) => info.has(f.id_cohorte))
    .map((f) => ({ ...f, promocion: info.get(f.id_cohorte).nombre, poblacion: info.get(f.id_cohorte).poblacion, _orden: info.get(f.id_cohorte).orden }))
    .sort((a, b) => a._orden - b._orden)
}

// Convierte columnas a fracción de la población de la promoción (vista «por estudiante» o «%»).
export const relativo = (filas, columnas) =>
  filas.map((f) => ({ ...f, ...Object.fromEntries(columnas.map((c) => [c, f.poblacion ? (f[c] ?? 0) / f.poblacion : null])) }))
