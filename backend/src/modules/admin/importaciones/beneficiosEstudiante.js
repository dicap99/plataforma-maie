// Hoja «Beneficios por estudiante» de la plantilla (reunión de avances del 20-oct-2026): si cada estudiante
// es becado, asistente de investigación o ayudante de docencia en cada semestre de su promoción.
// Cada estudiante que aparece en la hoja queda con exactamente los beneficios de sus filas (estudiante_beneficios)
// y su beca de la promoción se deduce de ellos; los estudiantes que no aparecen no cambian. De ahí sale la
// hoja «Beneficios» (reflejo.js).
const db = require('../../../config/db');
const { TIPOS_BENEFICIO, becaPrincipal, semestresConVariasBecas } = require('../../../utils/beneficios');
const { normalizar } = require('./excel.util');

// Misma forma que un recurso de recursos.definicion.js para reutilizar la plantilla y su lector.
const BENEFICIOS_ESTUDIANTE = {
  id: 'beneficios-estudiante',
  titulo: 'Beneficios de cada estudiante por semestre',
  hoja: 'Beneficios por estudiante',
  requisito: 'RF-ADM-01',
  campos: [
    { name: 'id_cohorte', label: 'Promoción', type: 'cohorte', required: true },
    { name: 'identificacion', label: 'Identificación del estudiante', type: 'texto', required: true },
    { name: 'estudiante', label: 'Estudiante', type: 'texto' },
    { name: 'semestre', label: 'Semestre de la promoción', type: 'semestre', required: true },
    { name: 'tipo', label: 'Beneficio', type: 'enum', options: TIPOS_BENEFICIO.map((t) => t.etiqueta), required: true },
  ],
};

const tipoPor = new Map(TIPOS_BENEFICIO.flatMap((t) => [[normalizar(t.etiqueta), t], [normalizar(t.valor), t]]));
const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());

// Filas actuales (exportación a Excel).
const listar = async () =>
  (await db.query(`
    SELECT h.nombre AS cohorte, u.identificacion, u.apellidos || ' ' || u.nombres AS estudiante, b.semestre, b.tipo
    FROM estudiante_beneficios b
    JOIN cohortes h ON h.id_cohorte = b.id_cohorte
    JOIN usuarios u ON u.id_usuario = b.id_estudiante
    ORDER BY h.periodo_inicio, h.nombre, u.apellidos, u.nombres, b.semestre`)).rows
    .map((f) => ({ ...f, tipo: TIPOS_BENEFICIO.find((t) => t.valor === f.tipo)?.etiqueta ?? f.tipo }));

// Guarda las filas dentro de la transacción de la importación (después de las demás hojas).
const guardar = async (cliente, filas, errores) => {
  const cuenta = { hoja: BENEFICIOS_ESTUDIANTE.hoja, filas: filas.length, insertados: 0, actualizados: 0 };
  const { rows: matriculas } = await cliente.query(`
    SELECT he.id_cohorte, he.id_estudiante, h.nombre AS cohorte, u.identificacion
    FROM cohorte_estudiantes he JOIN cohortes h ON h.id_cohorte = he.id_cohorte
    JOIN usuarios u ON u.id_usuario = he.id_estudiante`);
  const matricula = new Map(matriculas.map((m) => [`${normalizar(m.cohorte)}|${normalizar(m.identificacion)}`, m]));

  // Beneficios leídos por estudiante (y la primera fila de cada uno, para ubicar errores).
  const porEstudiante = new Map();
  for (const { fila, hoja, promocion, valores } of filas) {
    const error = (mensaje) => errores.push({ hoja, fila, mensaje });
    const m = matricula.get(`${normalizar(promocion)}|${normalizar(valores.identificacion)}`);
    const semestre = Number(valores.semestre);
    const tipo = tipoPor.get(normalizar(valores.tipo));
    if (!m) {
      error(`El estudiante "${texto(valores.identificacion)}" no está registrado en la promoción "${texto(promocion)}" (Gestión académica › Usuarios)`);
      continue;
    }
    if (!Number.isInteger(semestre) || semestre < 1 || semestre > 4) {
      error(`Semestre de la promoción "${texto(valores.semestre)}" no válido (1 a 4)`);
      continue;
    }
    if (!tipo) {
      error(`Beneficio "${texto(valores.tipo)}" no válido (${TIPOS_BENEFICIO.map((t) => t.etiqueta).join(', ')})`);
      continue;
    }
    const clave = `${m.id_cohorte}|${m.id_estudiante}`;
    if (!porEstudiante.has(clave)) porEstudiante.set(clave, { ...m, hoja, fila, beneficios: [] });
    porEstudiante.get(clave).beneficios.push({ semestre, tipo: tipo.valor });
  }

  for (const e of porEstudiante.values()) {
    const repetidas = semestresConVariasBecas(e.beneficios);
    if (repetidas.length) {
      errores.push({ hoja: e.hoja, fila: e.fila, mensaje: `${e.identificacion}: solo puede haber una beca por semestre (semestre ${repetidas.join(', ')})` });
      continue;
    }
    const unicos = [...new Map(e.beneficios.map((b) => [`${b.semestre}|${b.tipo}`, b])).values()];
    const { rowCount: anteriores } = await cliente.query(
      'DELETE FROM estudiante_beneficios WHERE id_cohorte = $1 AND id_estudiante = $2', [e.id_cohorte, e.id_estudiante],
    );
    await cliente.query(
      `INSERT INTO estudiante_beneficios (id_cohorte, id_estudiante, semestre, tipo)
       SELECT $1, $2, x.semestre, x.tipo FROM unnest($3::smallint[], $4::varchar[]) AS x(semestre, tipo)`,
      [e.id_cohorte, e.id_estudiante, unicos.map((b) => b.semestre), unicos.map((b) => b.tipo)],
    );
    await cliente.query(
      'UPDATE cohorte_estudiantes SET beca = $3 WHERE id_cohorte = $1 AND id_estudiante = $2',
      [e.id_cohorte, e.id_estudiante, becaPrincipal(unicos)],
    );
    if (anteriores) cuenta.actualizados += unicos.length;
    else cuenta.insertados += unicos.length;
  }
  return cuenta;
};

module.exports = { BENEFICIOS_ESTUDIANTE, HOJA: BENEFICIOS_ESTUDIANTE, listar, guardar };
