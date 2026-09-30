// OpenAPI del Módulo 2 (Resultados de Aprendizaje) y de las ofertas de curso que lo sostienen.
// Recibe los ayudantes de openapi.js para compartir el formato de respuestas y errores.
const { AGRUPACIONES } = require('../modules/ra/reportes/reportes.service');
const { MOMENTOS, CLAVES_NIVEL } = require('../modules/ra/rubrica');

const TAG_CURSOS = 'Módulo 2 · Cursos y matrícula';
const TAG_RA = 'Módulo 2 · Resultados de Aprendizaje';

module.exports = ({ exito, errores, cuerpo, roles, ref, PERIODO }) => {
  const entero = (name, descripcion, enPath = false) => ({
    name, in: enPath ? 'path' : 'query', required: enPath, schema: { type: 'integer', minimum: 1 }, description: descripcion,
  });
  const idCurso = entero('id', 'id_curso de la oferta', true);
  const porNivel = Object.fromEntries(CLAVES_NIVEL.map((n) => [n, { type: 'integer' }]));

  const schemas = {
    Nivel: {
      type: 'object',
      properties: { nivel: { type: 'string', enum: CLAVES_NIVEL }, etiqueta: { type: 'string' }, min: { type: 'number' }, rango: { type: 'string' } },
    },
    CursoCatalogo: {
      type: 'object',
      properties: {
        id_catalogo: { type: 'integer' }, codigo: { type: 'string', example: 'MaIE-CE2' }, nombre: { type: 'string' },
        semestre: { type: 'integer', minimum: 1, maximum: 4 }, orden: { type: 'integer' }, id_modulo: { type: 'integer' }, modulo: { type: 'string' },
        ras: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id_ra: { type: 'integer' }, codigo: { type: 'string' },
              nivel_dominio: { type: 'string', enum: ['Intermedio', 'Avanzado', 'Intermedio y avanzado'] },
              estrategias: { type: 'array', items: { type: 'string', example: 'E1' } },
            },
          },
        },
      },
    },
    Oferta: {
      type: 'object',
      properties: {
        id_curso: { type: 'integer' }, id_catalogo: { type: 'integer' }, codigo: { type: 'string' },
        nombre: { type: 'string', description: 'Nombre de la oferta o, si no tiene, el del catálogo' },
        nombre_catalogo: { type: 'string' }, nombre_oferta: { type: 'string', nullable: true },
        id_cohorte: { type: 'integer' }, cohorte: { type: 'string' }, periodo: PERIODO, grupo: { type: 'integer' },
        semestre: { type: 'integer' }, modulo: { type: 'string' },
        calificacion_abierta: { type: 'boolean', description: 'Si Coordinación abrió la calificación del semestre de la oferta' },
        docentes: { type: 'array', items: { type: 'object', properties: { id_usuario: { type: 'string', format: 'uuid' }, nombre: { type: 'string' } } } },
        ras: { type: 'array', items: { type: 'string' } },
        inscritos: { type: 'integer' }, notas: { type: 'integer', description: 'Notas de criterio registradas' },
        criterios: { type: 'integer', description: 'Criterios que se califican por estudiante' },
        estudiantes: { type: 'array', items: ref('EstudianteMatriculado'), description: 'Solo en el detalle' },
      },
    },
    OfertaEntrada: {
      type: 'object',
      required: ['id_catalogo', 'id_cohorte', 'periodo'],
      properties: {
        id_catalogo: { type: 'integer' }, id_cohorte: { type: 'integer' }, periodo: PERIODO,
        nombre: { type: 'string', nullable: true, maxLength: 150, example: 'Aprendizaje Profundo' },
        grupo: { type: 'integer', minimum: 1, default: 1 },
        docentes: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'Usuarios con rol docente' },
      },
    },
    EstudianteMatriculado: {
      type: 'object',
      properties: {
        id_estudiante: { type: 'string', format: 'uuid' }, identificacion: { type: 'string' }, nombres: { type: 'string' },
        apellidos: { type: 'string' }, email: { type: 'string' },
        estado: { type: 'string', enum: ['inscrito', 'matriculado', 'egresado', 'graduado', 'retirado'] },
      },
    },
    ResultadoAprendizaje: {
      type: 'object',
      properties: {
        id_ra: { type: 'integer' }, codigo: { type: 'string', example: 'RA2' }, descripcion: { type: 'string' },
        estrategias: { type: 'array', items: { type: 'object', properties: { codigo: { type: 'string' }, descripcion: { type: 'string' } } } },
        cursos: { type: 'array', items: { type: 'object' } }, criterios: { type: 'integer' },
      },
    },
    Criterio: {
      type: 'object',
      required: ['orden', 'nombre_criterio', 'peso_porcentaje', 'desc_nivel_alto', 'desc_nivel_medio', 'desc_nivel_basico', 'desc_nivel_insuficiente'],
      properties: {
        id_criterio: { type: 'integer', nullable: true, description: 'Omitir para crear un criterio nuevo' },
        orden: { type: 'integer', minimum: 1 }, nombre_criterio: { type: 'string', maxLength: 200 },
        peso_porcentaje: { type: 'number', exclusiveMinimum: true, minimum: 0, maximum: 100 },
        desc_nivel_alto: { type: 'string' }, desc_nivel_medio: { type: 'string' },
        desc_nivel_basico: { type: 'string' }, desc_nivel_insuficiente: { type: 'string' },
      },
    },
    Rubrica: {
      type: 'object',
      properties: {
        id_ra: { type: 'integer' }, codigo: { type: 'string' }, descripcion: { type: 'string' },
        suma_pesos: { type: 'number', example: 100 }, criterios: { type: 'array', items: ref('Criterio') },
      },
    },
    ResultadoRubrica: {
      type: 'object',
      properties: {
        total: { type: 'number', nullable: true, description: 'Suma ponderada; null si faltan criterios' },
        nivel: { type: 'string', enum: CLAVES_NIVEL, nullable: true },
        completo: { type: 'boolean' }, faltantes: { type: 'array', items: { type: 'integer' } },
      },
    },
    Planilla: {
      type: 'object',
      properties: {
        curso: ref('Oferta'),
        niveles: { type: 'array', items: ref('Nivel') },
        ras: { type: 'array', items: { type: 'object', description: 'RA del curso con estrategias, nivel de dominio y criterios' } },
        estudiantes: {
          type: 'array',
          items: {
            allOf: [ref('EstudianteMatriculado'), {
              type: 'object',
              properties: {
                notas: { type: 'object', additionalProperties: { type: 'number' }, description: '{ id_criterio: nota }' },
                resultados: { type: 'object', additionalProperties: ref('ResultadoRubrica'), description: '{ id_ra: resultado }' },
              },
            }],
          },
        },
      },
    },
    FilaDistribucion: {
      type: 'object',
      properties: {
        grupo: {}, etiqueta: { type: 'string' }, evaluados: { type: 'integer' }, ...porNivel,
        pct: { type: 'object', properties: Object.fromEntries(CLAVES_NIVEL.map((n) => [n, { type: 'number', description: 'Fracción 0–1' }])) },
        promedio: { type: 'number', nullable: true },
        validacion: { type: 'string', enum: ['Cumple', 'En riesgo', 'Sin datos'] },
      },
    },
    ReporteRA: {
      type: 'object',
      properties: {
        meta: {
          type: 'object',
          properties: {
            agrupar: { type: 'string', enum: AGRUPACIONES }, filtros: { type: 'object' }, niveles: { type: 'array', items: ref('Nivel') },
            meta_satisfactorio_pct: { type: 'number' }, estudiantes_evaluados: { type: 'integer' },
            unidades: { type: 'integer', description: 'Resultados estudiante–RA' },
            cumplimiento: { type: 'number', nullable: true, description: 'Fracción en Alto o Medio' },
            ras_en_riesgo: { type: 'integer' }, rubricas_incompletas: { type: 'integer' },
          },
        },
        porRA: { type: 'array', items: ref('FilaDistribucion'), description: 'Siempre RA1–RA7' },
        filas: { type: 'array', items: ref('FilaDistribucion'), description: 'Según `agrupar`' },
      },
    },
  };

  const filtrosReporte = [
    { name: 'agrupar', in: 'query', schema: { type: 'string', enum: AGRUPACIONES, default: 'ra' } },
    { name: 'momento', in: 'query', schema: { type: 'string', enum: ['todos', ...Object.keys(MOMENTOS)] }, description: 'inicio-III: cursos de semestres I–II; fin-IV: I–IV' },
    entero('cohorte', 'Promoción'), entero('modulo', 'Módulo curricular'), entero('catalogo', 'Curso del plan'),
    entero('curso', 'Oferta'), entero('ra', 'Resultado de aprendizaje'),
    { name: 'periodo', in: 'query', schema: PERIODO },
    { name: 'estudiante', in: 'query', schema: { type: 'string', format: 'uuid' } },
  ];

  const paths = {
    '/admin/cursos/catalogo': {
      get: {
        tags: [TAG_CURSOS], summary: 'Catálogo del plan de estudios con los RA de cada curso',
        description: roles(['coordinador', 'docente']),
        responses: { 200: exito({ type: 'array', items: ref('CursoCatalogo') }), ...errores(401, 403) },
      },
    },
    '/admin/cursos': {
      get: {
        tags: [TAG_CURSOS], summary: 'Ofertas de curso', description: `El docente recibe solo sus ofertas. ${roles(['coordinador', 'docente'])}`,
        parameters: [entero('cohorte', 'Promoción'), entero('catalogo', 'Curso del plan'), { name: 'periodo', in: 'query', schema: PERIODO }],
        responses: { 200: exito({ type: 'array', items: ref('Oferta') }), ...errores(400, 401, 403) },
      },
      post: {
        tags: [TAG_CURSOS], summary: 'Crear oferta', description: roles(['coordinador']),
        requestBody: cuerpo(ref('OfertaEntrada')), responses: { 201: exito(ref('Oferta'), 'Creada'), ...errores(400, 401, 403, 409) },
      },
    },
    '/admin/cursos/{id}': {
      parameters: [idCurso],
      get: { tags: [TAG_CURSOS], summary: 'Detalle de la oferta con estudiantes', description: roles(['coordinador', 'docente (propia)']), responses: { 200: exito(ref('Oferta')), ...errores(401, 403, 404) } },
      put: { tags: [TAG_CURSOS], summary: 'Actualizar oferta', description: roles(['coordinador']), requestBody: cuerpo(ref('OfertaEntrada')), responses: { 200: exito(ref('Oferta')), ...errores(400, 401, 403, 404, 409) } },
      delete: { tags: [TAG_CURSOS], summary: 'Eliminar oferta', description: `409 si tiene calificaciones. ${roles(['coordinador'])}`, responses: { 200: exito({ type: 'object' }), ...errores(401, 403, 404, 409) } },
    },
    '/admin/cursos/{id}/docentes': {
      parameters: [idCurso],
      put: {
        tags: [TAG_CURSOS], summary: 'Reemplazar los docentes de la oferta', description: roles(['coordinador']),
        requestBody: cuerpo({ type: 'object', required: ['docentes'], properties: { docentes: { type: 'array', items: { type: 'string', format: 'uuid' } } } }),
        responses: { 200: exito(ref('Oferta')), ...errores(400, 401, 403, 404) },
      },
    },
    '/admin/cursos/{id}/estudiantes': {
      parameters: [idCurso],
      put: {
        tags: [TAG_CURSOS], summary: 'Reemplazar los estudiantes inscritos',
        description: `Deben pertenecer a la promoción de la oferta (400). No se desmatricula a quien tiene notas (409). ${roles(['coordinador'])}`,
        requestBody: cuerpo({ type: 'object', required: ['estudiantes'], properties: { estudiantes: { type: 'array', items: { type: 'string', format: 'uuid' } } } }),
        responses: { 200: exito(ref('Oferta')), ...errores(400, 401, 403, 404, 409) },
      },
    },
    '/admin/cursos/{id}/estudiantes/cohorte': {
      parameters: [idCurso],
      post: {
        tags: [TAG_CURSOS], summary: 'Matricular a toda la promoción (sin retirados)', description: roles(['coordinador']),
        responses: { 200: exito({ type: 'object', properties: { agregados: { type: 'integer' }, curso: ref('Oferta') } }), ...errores(401, 403, 404) },
      },
    },
    '/admin/cohortes/{id}/estudiantes': {
      parameters: [entero('id', 'id_cohorte', true)],
      get: { tags: [TAG_CURSOS], summary: 'Estudiantes de la promoción', description: roles(['coordinador']), responses: { 200: exito({ type: 'array', items: ref('EstudianteMatriculado') }), ...errores(401, 403, 404) } },
      put: {
        tags: [TAG_CURSOS], summary: 'Reemplazar los estudiantes de la promoción', description: roles(['coordinador']),
        requestBody: cuerpo({
          type: 'object', required: ['estudiantes'],
          properties: { estudiantes: { type: 'array', items: { type: 'object', required: ['id_estudiante'], properties: { id_estudiante: { type: 'string', format: 'uuid' }, estado: { type: 'string', enum: ['inscrito', 'matriculado', 'egresado', 'graduado', 'retirado'] } } } } },
        }),
        responses: { 200: exito({ type: 'array', items: ref('EstudianteMatriculado') }), ...errores(400, 401, 403, 404) },
      },
    },
    '/ra/resultados': {
      get: { tags: [TAG_RA], summary: 'Resultados de aprendizaje RA1–RA7 (RF-RA-01)', description: roles(['coordinador', 'docente']), responses: { 200: exito({ type: 'array', items: ref('ResultadoAprendizaje') }), ...errores(401, 403) } },
    },
    '/ra/resultados/{id}': {
      parameters: [entero('id', 'id_ra', true)],
      get: { tags: [TAG_RA], summary: 'Un resultado de aprendizaje', responses: { 200: exito(ref('ResultadoAprendizaje')), ...errores(400, 401, 403, 404) } },
    },
    '/ra/estrategias': {
      get: { tags: [TAG_RA], summary: 'Estrategias de evaluación E1–E6', description: roles(['coordinador', 'docente']), responses: { 200: exito({ type: 'array', items: { type: 'object' } }), ...errores(401, 403) } },
    },
    '/ra/rubricas': {
      get: {
        tags: [TAG_RA], summary: 'Rúbricas por RA con los umbrales de nivel', description: roles(['coordinador', 'docente']),
        parameters: [entero('ra', 'Filtrar por id_ra')],
        responses: { 200: exito({ type: 'object', properties: { niveles: { type: 'array', items: ref('Nivel') }, ras: { type: 'array', items: ref('Rubrica') } } }), ...errores(400, 401, 403) },
      },
    },
    '/ra/rubricas/{idRa}': {
      parameters: [entero('idRa', 'id_ra', true)],
      put: {
        tags: [TAG_RA], summary: 'Reemplazar la rúbrica completa de un RA',
        description: `Los pesos deben sumar 100 % (400). No se pueden quitar criterios con notas (409). ${roles(['coordinador'])}`,
        requestBody: cuerpo({ type: 'object', required: ['criterios'], properties: { criterios: { type: 'array', minItems: 1, items: ref('Criterio') } } }),
        responses: { 200: exito(ref('Rubrica')), ...errores(400, 401, 403, 404, 409) },
      },
    },
    '/ra/evaluaciones': {
      get: {
        tags: [TAG_RA], summary: 'Planilla de calificación de una oferta (RF-RA-02)',
        description: `El docente solo accede a sus ofertas; Coordinación, en auditoría. ${roles(['coordinador', 'docente'])}`,
        parameters: [{ ...entero('curso', 'id_curso de la oferta'), required: true }],
        responses: { 200: exito(ref('Planilla')), ...errores(400, 401, 403, 404) },
      },
      post: {
        tags: [TAG_RA], summary: 'Registrar notas por criterio (lote)',
        description: 'Nota 0–5 con dos decimales por criterio; `null` borra la nota. El nivel y el total ponderado se calculan en el servidor. ' +
          `409 si la calificación del semestre está cerrada o el estudiante no está inscrito; 400 si el criterio no es de un RA del curso. ${roles(['docente del curso'])}`,
        requestBody: cuerpo({
          type: 'object', required: ['id_curso', 'calificaciones'],
          properties: {
            id_curso: { type: 'integer' },
            calificaciones: {
              type: 'array', minItems: 1,
              items: {
                type: 'object', required: ['id_estudiante', 'id_criterio', 'calificacion'],
                properties: { id_estudiante: { type: 'string', format: 'uuid' }, id_criterio: { type: 'integer' }, calificacion: { type: 'number', minimum: 0, maximum: 5, nullable: true } },
              },
            },
          },
        }),
        responses: { 201: exito(ref('Planilla'), 'Guardado; devuelve la planilla recalculada'), ...errores(400, 401, 403, 404, 409) },
      },
    },
    '/ra/periodos': {
      get: {
        tags: [TAG_RA], summary: 'Semestres académicos y estado de la calificación',
        description: `Un semestre sin estado registrado está cerrado. ${roles(['coordinador', 'docente'])}`,
        responses: {
          200: exito({ type: 'array', items: { type: 'object', properties: { periodo: PERIODO, abierto: { type: 'boolean' }, actualizado_en: { type: 'string', format: 'date-time', nullable: true }, cursos: { type: 'integer' } } } }),
          ...errores(401, 403),
        },
      },
    },
    '/ra/periodos/{periodo}': {
      parameters: [{ name: 'periodo', in: 'path', required: true, schema: PERIODO }],
      put: {
        tags: [TAG_RA], summary: 'Abrir o cerrar la calificación de un semestre', description: roles(['coordinador']),
        requestBody: cuerpo({ type: 'object', required: ['abierto'], properties: { abierto: { type: 'boolean' } } }),
        responses: { 200: exito({ type: 'object' }), ...errores(400, 401, 403) },
      },
    },
    '/ra/reportes': {
      get: {
        tags: [TAG_RA], summary: 'Distribución por nivel de logro (RF-RA-03, RF-RA-04)',
        description: 'Nivel de cada estudiante en cada RA = promedio de sus rúbricas completas dentro de los filtros. ' +
          `Reportes por RA, curso, curso del plan, módulo, promoción o estudiante, combinables con filtros. ${roles(['coordinador'])}`,
        parameters: filtrosReporte,
        responses: { 200: exito(ref('ReporteRA')), ...errores(400, 401, 403) },
      },
    },
    '/ra/reportes/exportar': {
      get: {
        tags: [TAG_RA], summary: 'Exportar el reporte a Excel', description: roles(['coordinador']),
        parameters: filtrosReporte,
        responses: {
          200: { description: 'Libro Excel', content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } } },
          ...errores(400, 401, 403),
        },
      },
    },
  };

  return { paths, schemas, tags: [{ name: TAG_CURSOS }, { name: TAG_RA }] };
};
