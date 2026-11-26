// OpenAPI del Módulo 3 (Evaluación Docente, Acuerdo 058 de 2022).
// Recibe los ayudantes de openapi.js para compartir el formato de respuestas y errores.
const { FORMULARIOS, POBLACIONES } = require('../modules/evalDocente/categorizacion');
const { VALORES, CATEGORIAS } = require('../modules/evalDocente/acuerdo058');
const { POBLACION_FILTRO } = require('../modules/evalDocente/resultados/consolidado');

const TAG = 'Módulo 3 · Evaluación Docente';

module.exports = ({ exito, errores, cuerpo, roles, ref, PERIODO }) => {
  const periodoPath = { name: 'periodo', in: 'path', required: true, schema: PERIODO };
  const periodoQuery = { name: 'periodo', in: 'query', required: true, schema: PERIODO };
  const poblacion = {
    name: 'poblacion', in: 'query', required: false, schema: { type: 'string', enum: POBLACION_FILTRO, default: 'todas' },
    description: 'EE de posgrado y pregrado unidos (todas) o separados',
  };
  const idDocente = { name: 'idDocente', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'id_docente del perfil docente' };
  const inscripcion = [
    { name: 'idCurso', in: 'path', required: true, schema: { type: 'integer' } },
    { name: 'idEstudiante', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
  ];
  const binario = (tipo, descripcion) => ({ description: descripcion, content: { [tipo]: { schema: { type: 'string', format: 'binary' } } } });
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const schemas = {
    PeriodoEvaluacion: {
      type: 'object',
      properties: {
        periodo: PERIODO,
        habilitada: { type: 'boolean', description: 'Coordinación habilitó la evaluación del semestre' },
        incluye_pregrado: { type: 'boolean', description: 'También evalúan los estudiantes de pregrado' },
        fecha_apertura: { type: 'string', format: 'date', nullable: true },
        fecha_cierre: { type: 'string', format: 'date', nullable: true },
        excluir_extremas: { type: 'boolean', description: 'Parágrafo 2 del Art. 12: excluir respuestas extremas si hay más de 10' },
        publicado: { type: 'boolean', description: 'Resultados visibles para los docentes (RF-EVAL-05)' },
        publicado_en: { type: 'string', format: 'date-time', nullable: true },
        abierta: { type: 'boolean', description: 'Si hoy recibe respuestas' },
        motivo: { type: 'string', nullable: true },
        avance: { type: 'object', description: 'Unidades, EE esperadas y recibidas por población, EC y AE (solo en listados)' },
      },
    },
    PeriodoEvaluacionEntrada: {
      type: 'object',
      properties: {
        habilitada: { type: 'boolean' }, incluye_pregrado: { type: 'boolean' }, excluir_extremas: { type: 'boolean' },
        fecha_apertura: { type: 'string', format: 'date', nullable: true }, fecha_cierre: { type: 'string', format: 'date', nullable: true },
      },
    },
    Formulario058: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: FORMULARIOS },
        valores: { type: 'array', items: { type: 'object', properties: { valor: { type: 'string', enum: VALORES }, etiqueta: { type: 'string' } } } },
        caracteristicas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              caracteristica: { type: 'integer' }, nombre: { type: 'string' },
              cuenta_docente: { type: 'boolean', description: 'false en la característica 0 del EE (autoevaluación del estudiante)' },
              preguntas: { type: 'array', items: { type: 'object', properties: { id_pregunta: { type: 'integer' }, codigo: { type: 'string', example: '1.1' }, texto: { type: 'string' }, escala: { type: 'string', nullable: true } } } },
            },
          },
        },
      },
    },
    RespuestaEntrada: {
      type: 'object',
      required: ['periodo', 'tipo', 'id_docente', 'respuestas'],
      properties: {
        periodo: PERIODO,
        tipo: { type: 'string', enum: FORMULARIOS },
        id_docente: { type: 'string', format: 'uuid' },
        id_cohorte: { type: 'integer', description: 'Obligatoria en EC y AE; en el EE la fija la plataforma' },
        respuestas: { type: 'object', additionalProperties: { type: 'string', enum: VALORES }, description: '{ id_pregunta: valoración } con todas las preguntas del formulario' },
        comentario: { type: 'string', nullable: true, description: 'Art. 7: opiniones, sugerencias y recomendaciones' },
      },
    },
    ConsolidadoEvaluacion: {
      type: 'object',
      description: 'Por unidad (docente × promoción): EE, EC y AE por separado; cada característica con el %IP oficial (Acuerdo) ' +
        'y `excel` (método del Excel de Coordinación, referencia histórica). IDST-D por variable y por característica. Por promoción ' +
        `y programa: IDSC (Acuerdo), promedio del %IP e IDST-P. Categorías: ${CATEGORIAS.map((c) => `${c.sigla} ≥ ${c.min}`).join(', ')}.`,
      properties: {
        periodo: ref('PeriodoEvaluacion'),
        configuracion: { type: 'object' },
        unidades: { type: 'array', items: { type: 'object' } },
        promociones: { type: 'array', items: { type: 'object' } },
        programa: { type: 'object' },
        historico: { type: 'array', items: { type: 'object' } },
      },
    },
  };

  const paths = {
    '/eval-docente/periodos': {
      get: {
        tags: [TAG], summary: 'Semestres y habilitación de la evaluación docente',
        description: `Semestres con ofertas, su configuración, si reciben respuestas hoy y el avance de diligenciamiento. ${roles(['coordinador'])}`,
        responses: { 200: exito({ type: 'array', items: ref('PeriodoEvaluacion') }), ...errores(401, 403) },
      },
    },
    '/eval-docente/periodos/{periodo}': {
      parameters: [periodoPath],
      get: { tags: [TAG], summary: 'Configuración y avance de un semestre', description: roles(['coordinador']), responses: { 200: exito(ref('PeriodoEvaluacion')), ...errores(400, 401, 403) } },
      put: {
        tags: [TAG], summary: 'Habilitar/deshabilitar, cronograma y opciones del semestre',
        description: `Separada de la apertura de rúbricas del Módulo 2. Con resultados publicados responde 409. ${roles(['coordinador'])}`,
        requestBody: cuerpo(ref('PeriodoEvaluacionEntrada')),
        responses: { 200: exito(ref('PeriodoEvaluacion')), ...errores(400, 401, 403, 409) },
      },
    },
    '/eval-docente/periodos/{periodo}/publicacion': {
      parameters: [periodoPath],
      post: {
        tags: [TAG], summary: 'Publicar o retirar la publicación de los resultados',
        description: `Publicar exige la evaluación deshabilitada y con respuestas (409). ${roles(['coordinador'])}`,
        requestBody: cuerpo({ type: 'object', required: ['publicado'], properties: { publicado: { type: 'boolean' } } }),
        responses: { 200: exito(ref('PeriodoEvaluacion')), ...errores(400, 401, 403, 404, 409) },
      },
    },
    '/eval-docente/formularios/{tipo}': {
      parameters: [{ name: 'tipo', in: 'path', required: true, schema: { type: 'string', enum: FORMULARIOS } }],
      get: { tags: [TAG], summary: 'Instrumento EE, EC o AE (Art. 4, 5 y 6)', description: roles(['coordinador', 'docente', 'estudiante']), responses: { 200: exito(ref('Formulario058')), ...errores(400, 401) } },
    },
    '/eval-docente/formularios/{tipo}/preguntas': {
      parameters: [{ name: 'tipo', in: 'path', required: true, schema: { type: 'string', enum: FORMULARIOS } }],
      get: { tags: [TAG], summary: 'Preguntas del formulario (activas e inactivas) con su número de respuestas (Art. 8)', description: roles(['coordinador']), responses: { 200: exito({ type: 'array', items: { type: 'object' } }), ...errores(400, 401, 403) } },
      post: {
        tags: [TAG], summary: 'Agregar una pregunta al final de su característica (código generado)',
        description: 'Una característica nueva exige `nombre_caracteristica`. Aplica a las evaluaciones que se diligencien desde ese momento. ' + roles(['coordinador']),
        requestBody: cuerpo({ type: 'object', required: ['caracteristica', 'texto'], properties: { caracteristica: { type: 'integer', minimum: 0, maximum: 9 }, nombre_caracteristica: { type: 'string' }, texto: { type: 'string' }, escala: { type: 'string', nullable: true } } }),
        responses: { 201: exito({ type: 'object' }), ...errores(400, 401, 403) },
      },
    },
    '/eval-docente/formularios/preguntas/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      put: {
        tags: [TAG], summary: 'Editar redacción o escala, o activar/desactivar una pregunta',
        description: 'Una pregunta con respuestas no cambia de redacción ni de escala (409): se desactiva y se agrega otra. Los resultados de cada semestre conservan las preguntas respondidas en él. ' + roles(['coordinador']),
        requestBody: cuerpo({ type: 'object', properties: { texto: { type: 'string' }, escala: { type: 'string', nullable: true }, activa: { type: 'boolean' } } }),
        responses: { 200: exito({ type: 'object' }), ...errores(400, 401, 403, 404, 409) },
      },
      delete: { tags: [TAG], summary: 'Eliminar una pregunta sin respuestas (409 si tiene)', description: roles(['coordinador']), responses: { 200: exito({ type: 'object' }), ...errores(401, 403, 404, 409) } },
    },
    '/eval-docente/categorizacion': {
      get: { tags: [TAG], summary: 'Matriz de quién evalúa a quién y casos borde', description: roles(['coordinador', 'docente', 'estudiante']), responses: { 200: exito({ type: 'object' }), ...errores(401) } },
    },
    '/eval-docente/pendientes': {
      get: {
        tags: [TAG], summary: 'Formularios que le corresponden al usuario',
        description: 'Estudiante: un EE por docente de sus cursos del semestre. Coordinación: una EC por docente y promoción (salvo su propio perfil). ' +
          `Docente: una AE por promoción. ${roles(['coordinador', 'docente', 'estudiante'])}`,
        responses: { 200: exito({ type: 'array', items: { type: 'object' } }), ...errores(401) },
      },
    },
    '/eval-docente/respuestas': {
      post: {
        tags: [TAG], summary: 'Enviar un formulario (RF-EVAL-01)',
        description: 'EE anónimo: se guarda sin evaluador y una constancia aparte impide responder dos veces al mismo docente en el semestre (409). ' +
          `EC y AE se pueden corregir mientras la evaluación está abierta. Fuera de fechas o sin habilitar: 409. ${roles(['coordinador', 'docente', 'estudiante'])}`,
        requestBody: cuerpo(ref('RespuestaEntrada')),
        responses: { 201: exito({ type: 'object', properties: { registrada: { type: 'boolean' }, tipo: { type: 'string' } } }), ...errores(400, 401, 403, 409) },
      },
    },
    '/eval-docente/respuestas/propia': {
      get: {
        tags: [TAG], summary: 'EC o AE ya guardada (para corregirla)',
        description: `El EE no se puede consultar (anónimo). ${roles(['coordinador', 'docente'])}`,
        parameters: [periodoQuery, { name: 'tipo', in: 'query', required: true, schema: { type: 'string', enum: ['EC', 'AE'] } },
          { name: 'id_docente', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'id_cohorte', in: 'query', required: true, schema: { type: 'integer' } }],
        responses: { 200: exito({ type: 'object', nullable: true }), ...errores(400, 401, 403) },
      },
    },
    '/eval-docente/resultados': {
      get: {
        tags: [TAG], summary: 'Consolidado del semestre e histórico (RF-EVAL-02 a 04)',
        description: roles(['coordinador']), parameters: [periodoQuery, poblacion],
        responses: { 200: exito(ref('ConsolidadoEvaluacion')), ...errores(400, 401, 403, 404) },
      },
    },
    '/eval-docente/resultados/exportar': {
      get: {
        tags: [TAG], summary: 'Libro Excel con el formato de Coordinación', description: roles(['coordinador']), parameters: [periodoQuery, poblacion],
        responses: { 200: binario(XLSX, 'Libro Excel'), ...errores(400, 401, 403, 404) },
      },
    },
    '/eval-docente/resultados/informe.pdf': {
      get: {
        tags: [TAG], summary: 'Informe consolidado en PDF con gráficas', description: roles(['coordinador']), parameters: [periodoQuery, poblacion],
        responses: { 200: binario('application/pdf', 'Informe PDF'), ...errores(400, 401, 403, 404) },
      },
    },
    '/eval-docente/resultados/me': {
      get: {
        tags: [TAG], summary: 'Resultados propios del docente (RF-EVAL-05)',
        description: `Solo semestres publicados; EE, EC y AE por separado. ${roles(['docente', 'coordinador'])}`,
        responses: { 200: exito({ type: 'object' }), ...errores(401, 403, 404) },
      },
    },
    '/eval-docente/resultados/me/informe.pdf': {
      get: { tags: [TAG], summary: 'Informe PDF propio con histórico', description: roles(['docente', 'coordinador']), responses: { 200: binario('application/pdf', 'Informe PDF'), ...errores(401, 403, 404) } },
    },
    '/eval-docente/resultados/docentes/{idDocente}': {
      parameters: [idDocente],
      get: { tags: [TAG], summary: 'Resultados de un docente en todos los semestres', description: roles(['coordinador']), responses: { 200: exito({ type: 'object' }), ...errores(400, 401, 403, 404) } },
    },
    '/eval-docente/resultados/docentes/{idDocente}/informe.pdf': {
      parameters: [idDocente],
      get: { tags: [TAG], summary: 'Informe PDF por docente con gráficas históricas', description: roles(['coordinador']), responses: { 200: binario('application/pdf', 'Informe PDF'), ...errores(400, 401, 403, 404) } },
    },
    '/eval-docente/pregrado': {
      get: {
        tags: [TAG], summary: 'Estudiantes de pregrado por semestre, promoción y curso',
        description: roles(['coordinador']), parameters: [{ ...periodoQuery, required: false }],
        responses: { 200: exito({ type: 'array', items: { type: 'object' } }), ...errores(400, 401, 403) },
      },
      post: {
        tags: [TAG], summary: 'Inscribir un estudiante de pregrado en una oferta',
        description: roles(['coordinador']),
        requestBody: cuerpo({
          type: 'object', required: ['id_curso', 'id_estudiante'],
          properties: {
            id_curso: { type: 'integer', minimum: 1 },
            id_estudiante: { type: 'string', format: 'uuid' },
            programa: { type: 'string', maxLength: 150, nullable: true },
          },
        }),
        responses: { 201: exito({ type: 'object' }, 'Inscrito'), ...errores(400, 401, 403, 404, 409) },
      },
    },
    '/eval-docente/pregrado/plantilla': {
      get: { tags: [TAG], summary: 'Plantilla Excel de la lista de pregrado', description: roles(['coordinador']), parameters: [{ ...periodoQuery, required: false }], responses: { 200: binario(XLSX, 'Plantilla'), ...errores(400, 401, 403) } },
    },
    '/eval-docente/pregrado/importar': {
      post: {
        tags: [TAG], summary: 'Cargar la lista de pregrado (validar → confirmar)',
        description: 'Todo o nada. Con ?simular=true solo valida. Crea las cuentas que falten (rol estudiante, contraseña temporal que se devuelve ' +
          `una sola vez al confirmar). ${roles(['coordinador'])}`,
        parameters: [{ name: 'simular', in: 'query', required: false, schema: { type: 'boolean' } }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { archivo: { type: 'string', format: 'binary' } } } } } },
        responses: { 200: exito({ type: 'object' }, 'Validación (simulación)'), 201: exito({ type: 'object' }, 'Importado'), ...errores(400, 401, 403) },
      },
    },
    '/eval-docente/pregrado/{idCurso}/{idEstudiante}': {
      parameters: inscripcion,
      put: {
        tags: [TAG], summary: 'Marcar inscrito o retirado', description: roles(['coordinador']),
        requestBody: cuerpo({ type: 'object', required: ['estado'], properties: { estado: { type: 'string', enum: ['inscrito', 'retirado'] } } }),
        responses: { 200: exito({ type: 'object' }), ...errores(400, 401, 403, 404) },
      },
      delete: { tags: [TAG], summary: 'Quitar de la lista (la cuenta se conserva)', description: roles(['coordinador']), responses: { 200: exito({ type: 'object' }), ...errores(400, 401, 403, 404) } },
    },
  };

  return { paths, schemas, tags: [{ name: TAG, description: `Acuerdo 058 de 2022. Poblaciones de estudiantes: ${POBLACIONES.join(' y ')}.` }] };
};
