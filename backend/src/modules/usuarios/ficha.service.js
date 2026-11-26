// Ficha de detalle de un usuario según su rol (Gestión académica › Usuarios, decisión del usuario 2026-11-24).
//  - Estudiante de posgrado: promoción(es), materias matriculadas por semestre (con las electivas), beneficios
//    por semestre y producción académica vinculada (solo consulta: se registran en Datos del programa).
//  - Estudiante de pregrado: materias de la maestría que cursó en cada semestre.
//  - Docente: perfil institucional y materias que dictó por semestre y promoción.
// Lo que aún no está registrado se devuelve vacío: la interfaz lo muestra como pendiente.
const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const repository = require('./usuarios.repository');

const filas = async (sql, params) => (await db.query(sql, params)).rows;

const MATERIAS = `
  SELECT c.id_curso, c.periodo, c.grupo, cl.codigo AS clase_codigo, cl.nombre AS materia,
         k.codigo AS curso_codigo, k.nombre AS curso_plan, k.semestre AS semestre_plan, m.nombre AS componente,
         h.id_cohorte, h.nombre AS cohorte,
         COALESCE((SELECT string_agg(d.nombre_completo, ', ' ORDER BY d.nombre_completo)
                   FROM curso_docentes cd JOIN docentes_perfil d USING (id_docente) WHERE cd.id_curso = c.id_curso), '') AS docentes
  FROM cursos c
  JOIN clases cl ON cl.id_clase = c.id_clase
  JOIN cursos_catalogo k ON k.id_catalogo = c.id_catalogo
  JOIN modulos_curriculares m ON m.id_modulo = k.id_modulo
  JOIN cohortes h ON h.id_cohorte = c.id_cohorte`;

const estudiante = async (id) => {
  const [promociones, materias, beneficios, produccion, pregrado] = await Promise.all([
    filas(`SELECT ce.id_cohorte, h.nombre AS cohorte, h.periodo_inicio, h.periodo_fin, ce.estado, ce.beca, ce.fecha_grado
           FROM cohorte_estudiantes ce JOIN cohortes h USING (id_cohorte)
           WHERE ce.id_estudiante = $1 ORDER BY h.periodo_inicio`, [id]),
    filas(`${MATERIAS} JOIN curso_estudiantes ce ON ce.id_curso = c.id_curso
           WHERE ce.id_estudiante = $1 ORDER BY c.periodo, k.orden, cl.nombre`, [id]),
    filas(`SELECT b.id_cohorte, h.nombre AS cohorte, b.semestre, b.tipo, b.detalle
           FROM estudiante_beneficios b JOIN cohortes h USING (id_cohorte)
           WHERE b.id_estudiante = $1 ORDER BY h.periodo_inicio, b.semestre, b.tipo`, [id]),
    filas(`SELECT p.id_producto, p.tipo, p.cita, p.anio, p.enlace, h.nombre AS cohorte
           FROM producto_estudiantes pe JOIN productos_investigacion p USING (id_producto) JOIN cohortes h USING (id_cohorte)
           WHERE pe.id_estudiante = $1 ORDER BY p.anio DESC NULLS LAST, p.tipo, p.cita`, [id]),
    filas(`${MATERIAS} JOIN curso_estudiantes_pregrado cp ON cp.id_curso = c.id_curso
           WHERE cp.id_estudiante = $1 ORDER BY c.periodo, cl.nombre`, [id]),
  ]);
  return {
    poblacion: promociones.length ? 'posgrado' : pregrado.length ? 'pregrado' : null,
    promociones, materias, beneficios, produccion, pregrado,
  };
};

const docente = async (u) => {
  const [perfil] = u.id_docente
    ? await filas(`SELECT id_docente, nombre_completo, afiliacion, departamento, universidad, formacion_profesional,
                          campo_formacion, linea_investigacion, grupo_investigacion, vinculacion_tipo, enlace_perfil
                   FROM docentes_perfil WHERE id_docente = $1`, [u.id_docente])
    : [];
  const materias = perfil
    ? await filas(`${MATERIAS} JOIN curso_docentes cd ON cd.id_curso = c.id_curso
                   WHERE cd.id_docente = $1 ORDER BY c.periodo, h.periodo_inicio, cl.nombre`, [perfil.id_docente])
    : [];
  return { perfil: perfil ?? null, materias };
};

module.exports = {
  // GET /usuarios/:id/ficha
  async ficha({ params }) {
    const u = await repository.get(params.id);
    if (!u) throw ApiError.notFound('Usuario no encontrado');
    const detalle = u.rol === 'estudiante' ? await estudiante(u.id_usuario) : u.rol === 'docente' ? await docente(u) : {};
    return { usuario: u, ...detalle };
  },
};
