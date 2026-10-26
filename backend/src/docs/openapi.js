// Especificación OpenAPI 3 de la API MaIE.
// Las rutas CRUD del Módulo 1 se generan desde recursos.definicion.js (misma fuente que la API,
// la validación y la importación), así la documentación no se desfasa al agregar una hoja.
const { RECURSOS } = require('../modules/admin/recursos/recursos.definicion');
const { TODOS } = require('../utils/roles');
const { VALORES_BENEFICIO } = require('../utils/beneficios');
const moduloRA = require('./openapi.ra');

const PERIODO = { type: 'string', pattern: '^\\d{4}-[AB]$', example: '2024-A' };

// Tipo de campo del recurso → esquema OpenAPI
const ESQUEMA_TIPO = {
  entero: () => ({ type: 'integer', minimum: 0 }),
  semestre: () => ({ type: 'integer', minimum: 1, maximum: 4 }),
  cohorte: () => ({ type: 'integer', minimum: 1, description: 'id_cohorte de la promoción' }),
  numero: () => ({ type: 'number' }),
  dinero: () => ({ type: 'number', description: 'Pesos colombianos (COP)' }),
  texto: () => ({ type: 'string' }),
  periodo: () => ({ ...PERIODO }),
  fecha: () => ({ type: 'string', format: 'date' }),
  enum: (c) => ({ type: 'string', enum: c.options }),
};

// Llaves generadas por la BD (no forman parte de los campos editables)
const LLAVES_GENERADAS = {
  id_cohorte: { type: 'integer', readOnly: true },
  id_presupuesto: { type: 'integer', readOnly: true },
  id_producto: { type: 'integer', readOnly: true },
  id_docente: { type: 'string', format: 'uuid', readOnly: true },
};

// Columnas calculadas que devuelve el API además de los campos
const EXTRAS = {
  cohortes: { anio_inicio: { type: 'integer', readOnly: true }, anio_fin: { type: 'integer', readOnly: true } },
  presupuesto: { saldo_comprometido: { type: 'number', readOnly: true, description: 'ingresos − gastos comprometidos' } },
  docentes: { id_usuario: { type: 'string', format: 'uuid', nullable: true, readOnly: true } },
};

const nombreEsquema = (recurso) =>
  recurso.id.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());

const esquemaCampo = (campo) => ({
  ...ESQUEMA_TIPO[campo.type](campo),
  title: campo.label,
  ...(campo.required ? {} : { nullable: true }),
});

const esquemasRecurso = (recurso) => {
  const nombre = nombreEsquema(recurso);
  const propiedades = Object.fromEntries(recurso.campos.map((c) => [c.name, esquemaCampo(c)]));
  const requeridos = recurso.campos.filter((c) => c.required).map((c) => c.name);
  const llaves = Object.fromEntries(
    recurso.llave.filter((k) => !propiedades[k]).map((k) => [k, LLAVES_GENERADAS[k]]),
  );
  return {
    [`${nombre}Entrada`]: { type: 'object', required: requeridos, properties: propiedades },
    [nombre]: {
      type: 'object',
      properties: {
        ...llaves,
        ...propiedades,
        ...(recurso.unirCohorte ? { cohorte: { type: 'string', readOnly: true, description: 'Nombre de la promoción' } } : {}),
        ...(EXTRAS[recurso.id] ?? {}),
      },
    },
  };
};

const ref = (nombre) => ({ $ref: `#/components/schemas/${nombre}` });
const exito = (esquema, descripcion = 'OK') => ({
  description: descripcion,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { status: { type: 'string', enum: ['success'] }, data: esquema } },
    },
  },
});
const errores = (...codigos) => Object.fromEntries(codigos.map((c) => [c, { $ref: `#/components/responses/E${c}` }]));
const cuerpo = (esquema) => ({ required: true, content: { 'application/json': { schema: esquema } } });
const roles = (lista) => `**Roles:** ${lista.join(', ')}`;

const parametroLlave = (recurso, k) => {
  const campo = recurso.campos.find((c) => c.name === k);
  return {
    name: k,
    in: 'path',
    required: true,
    schema: campo ? ESQUEMA_TIPO[campo.type](campo) : { ...LLAVES_GENERADAS[k], readOnly: undefined },
  };
};

const rutasRecurso = (recurso) => {
  const nombre = nombreEsquema(recurso);
  const tag = `Módulo 1 · ${recurso.titulo}`;
  const base = `/admin/${recurso.id}`;
  const conLlave = `${base}/${recurso.llave.map((k) => `{${k}}`).join('/')}`;
  const params = recurso.llave.map((k) => parametroLlave(recurso, k));
  const lectura = roles(recurso.rolesLectura);
  const escritura = roles(recurso.rolesEscritura);
  const hoja = `${recurso.requisito} · hoja «${recurso.hoja}».`;
  return {
    [base]: {
      get: {
        tags: [tag], summary: `Listar ${recurso.titulo.toLowerCase()}`, description: `${hoja} ${lectura}`,
        responses: { 200: exito({ type: 'array', items: ref(nombre) }), ...errores(401, 403) },
      },
      post: {
        tags: [tag], summary: 'Crear registro', description: `${hoja} ${escritura}`,
        requestBody: cuerpo(ref(`${nombre}Entrada`)),
        responses: { 201: exito(ref(nombre), 'Creado'), ...errores(400, 401, 403, 409) },
      },
    },
    [conLlave]: {
      parameters: params,
      get: {
        tags: [tag], summary: 'Obtener registro', description: lectura,
        responses: { 200: exito(ref(nombre)), ...errores(401, 403, 404) },
      },
      put: {
        tags: [tag], summary: 'Reemplazar registro',
        description: `Reemplaza el registro completo; la llave de la URL no se modifica. ${escritura}`,
        requestBody: cuerpo(ref(`${nombre}Entrada`)),
        responses: { 200: exito(ref(nombre)), ...errores(400, 401, 403, 404, 409) },
      },
      delete: {
        tags: [tag], summary: 'Eliminar registro',
        description: `${recurso.id === 'cohortes' ? 'Elimina también los datos asociados a la promoción. ' : ''}${escritura}`,
        responses: { 200: exito({ type: 'object', properties: { eliminado: { type: 'boolean' } } }), ...errores(401, 403, 404, 409) },
      },
    },
  };
};

const Usuario = {
  type: 'object',
  properties: {
    id_usuario: { type: 'string', format: 'uuid' },
    identificacion: { type: 'string' },
    nombres: { type: 'string' },
    apellidos: { type: 'string' },
    email: { type: 'string', format: 'email' },
    rol: { type: 'string', enum: TODOS },
    debe_cambiar_password: { type: 'boolean', description: 'Cuenta con credenciales temporales' },
    activo: { type: 'boolean' },
    id_docente: { type: 'string', format: 'uuid', nullable: true }, docente_vinculado: { type: 'string', nullable: true },
    afiliacion: { type: 'string', enum: ['UDENAR', 'EXTERNO'], nullable: true }, campo_formacion: { type: 'string', nullable: true },
    id_cohorte: { type: 'integer', nullable: true }, cohorte: { type: 'string', nullable: true },
    beca: { type: 'string', enum: ['100', 'hora_catedra', 'sintraunicol'], nullable: true },
    beneficios: { type: 'array', items: { $ref: '#/components/schemas/BeneficioSemestre' } },
  },
};

const BeneficioSemestre = {
  type: 'object',
  required: ['semestre', 'tipo'],
  properties: {
    semestre: { type: 'integer', minimum: 1, maximum: 4, description: 'Semestre de la promoción' },
    tipo: { type: 'string', enum: VALORES_BENEFICIO, description: 'Una sola beca por semestre; asistencias y ayudantías se suman' },
  },
};

const UsuarioEntrada = {
  type: 'object',
  required: ['identificacion', 'nombres', 'apellidos', 'email', 'rol'],
  properties: {
    identificacion: { type: 'string' },
    nombres: { type: 'string' },
    apellidos: { type: 'string' },
    email: { type: 'string', format: 'email' },
    rol: { type: 'string', enum: TODOS },
    activo: { type: 'boolean', default: true },
    password: { type: 'string', minLength: 8, description: 'Obligatoria al crear; opcional al editar' },
    id_docente: { type: 'string', format: 'uuid', nullable: true, description: 'Perfil docente a vincular (solo rol docente)' },
    afiliacion: { type: 'string', enum: ['UDENAR', 'EXTERNO'], nullable: true, description: 'Docente: obligatoria si no tiene perfil' },
    campos_formacion: { type: 'array', items: { type: 'string', maxLength: 100 }, description: 'Docente: campos de formación' },
    id_cohorte: { type: 'integer', nullable: true, description: 'Estudiante: promoción (null la quita)' },
    beca: { type: 'string', enum: ['100', 'hora_catedra', 'sintraunicol'], nullable: true, description: 'Estudiante: tipo de beca (requiere promoción)' },
    beneficios: {
      type: 'array', items: { $ref: '#/components/schemas/BeneficioSemestre' },
      description: 'Estudiante: beneficios por semestre (reemplazan los anteriores; la beca se deduce de ellos)',
    },
  },
};

const PENDIENTES = [
  ['/eval-docente/periodos', 'get', 'Periodos de evaluación docente'],
  ['/eval-docente/formularios/{tipo}', 'get', 'Formulario EE/EC/AE del Acuerdo 058'],
  ['/eval-docente/respuestas', 'post', 'Enviar un formulario de evaluación'],
  ['/eval-docente/resultados/me', 'get', 'Resultados propios del docente'],
];

const rutasPendientes = () => {
  const rutas = {};
  for (const [ruta, metodo, resumen] of PENDIENTES) {
    const tag = 'Módulo 3 · Evaluación Docente (pendiente)';
    rutas[ruta] = {
      ...(ruta.includes('{tipo}')
        ? { parameters: [{ name: 'tipo', in: 'path', required: true, schema: { type: 'string', enum: ['EE', 'EC', 'AE'] } }] }
        : {}),
      [metodo]: {
        tags: [tag], summary: resumen, description: 'Pendiente de implementación: responde 501.',
        responses: { 501: { $ref: '#/components/responses/E501' }, ...errores(401, 403) },
      },
    };
  }
  return rutas;
};

const construir = () => {
  const esquemasRecursos = Object.assign({}, ...RECURSOS.map(esquemasRecurso));
  const rutasRecursos = Object.assign({}, ...RECURSOS.map(rutasRecurso));
  const ra = moduloRA({ exito, errores, cuerpo, roles, ref, PERIODO });
  const respuestaError = (descripcion) => ({ description: descripcion, content: { 'application/json': { schema: ref('Error') } } });

  return {
    openapi: '3.0.3',
    info: {
      title: 'API Plataforma MaIE',
      version: '1.0.0',
      description:
        'API de la Plataforma Informática de la Maestría en Ingeniería Electrónica (Universidad de Nariño).\n\n' +
        '1. Obtenga un token con **POST /auth/login**.\n2. Pulse **Authorize** y pegue el token.\n\n' +
        'Todas las respuestas usan `{ "status": "success", "data": … }` o `{ "status": "error", "error": { "message", "details" } }`.',
    },
    servers: [{ url: '/api/v1' }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Autenticación' },
      { name: 'Usuarios' },
      { name: 'Módulo 1 · General', description: 'Metadatos, importación, plantilla y estadísticas' },
      ...ra.tags,
    ],
    paths: {
      '/auth/login': {
        post: {
          tags: ['Autenticación'], summary: 'Iniciar sesión', security: [],
          requestBody: cuerpo({
            type: 'object', required: ['email', 'password'],
            properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } },
          }),
          responses: {
            200: exito({ type: 'object', properties: { token: { type: 'string', description: 'JWT (8 h)' }, usuario: ref('Usuario') } }),
            ...errores(400, 401, 403),
          },
        },
      },
      '/auth/me': {
        get: { tags: ['Autenticación'], summary: 'Usuario de la sesión actual', responses: { 200: exito(ref('Usuario')), ...errores(401) } },
        put: {
          tags: ['Autenticación'], summary: 'Actualizar identificación y correo de la propia cuenta',
          description: 'El correo es el que se usa para iniciar sesión. Las cuentas temporales (`debe_cambiar_password`) los traen provisionales.',
          requestBody: cuerpo({ type: 'object', properties: { identificacion: { type: 'string', maxLength: 20 }, email: { type: 'string', format: 'email' } } }),
          responses: { 200: exito(ref('Usuario')), ...errores(400, 401, 409) },
        },
      },
      '/auth/password': {
        put: {
          tags: ['Autenticación'], summary: 'Cambiar la contraseña propia',
          requestBody: cuerpo({
            type: 'object', required: ['actual', 'nueva'],
            properties: { actual: { type: 'string', format: 'password' }, nueva: { type: 'string', format: 'password', minLength: 8 } },
          }),
          responses: { 200: exito({ type: 'object', properties: { mensaje: { type: 'string' } } }), ...errores(400, 401) },
        },
      },
      '/usuarios': {
        get: { tags: ['Usuarios'], summary: 'Listar usuarios', description: roles(['coordinador']), responses: { 200: exito({ type: 'array', items: ref('Usuario') }), ...errores(401, 403) } },
        post: { tags: ['Usuarios'], summary: 'Crear usuario', description: roles(['coordinador']), requestBody: cuerpo(ref('UsuarioEntrada')), responses: { 201: exito(ref('Usuario'), 'Creado'), ...errores(400, 401, 403, 409) } },
      },
      '/usuarios/campos-formacion': {
        get: { tags: ['Usuarios'], summary: 'Campos de formación registrados (selector del formulario)', description: roles(['coordinador']),
          responses: { 200: exito({ type: 'array', items: { type: 'string' } }), ...errores(401, 403) } },
      },
      '/admin/academico/reflejo': {
        get: {
          tags: ['Módulo 1 · General'], summary: 'Hojas académicas con el reflejo de Gestión académica',
          description: 'Promociones, beneficios y cursos y docentes por semestre: las promociones con registros en Gestión (estudiantes, becas, clases ofertadas) se calculan desde ahí; las demás conservan la hoja. Cada fila trae `origen` (gestion | registro). ' + roles(['coordinador', 'docente']),
          responses: { 200: exito({ type: 'object', properties: { cohortes: { type: 'array', items: { type: 'object' } }, beneficios: { type: 'array', items: { type: 'object' } }, 'cohorte-semestres': { type: 'array', items: { type: 'object' } } } }), ...errores(401, 403) },
        },
      },
      '/usuarios/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        get: { tags: ['Usuarios'], summary: 'Obtener usuario', responses: { 200: exito(ref('Usuario')), ...errores(401, 403, 404) } },
        put: { tags: ['Usuarios'], summary: 'Actualizar usuario', requestBody: cuerpo(ref('UsuarioEntrada')), responses: { 200: exito(ref('Usuario')), ...errores(400, 401, 403, 404, 409) } },
        delete: { tags: ['Usuarios'], summary: 'Eliminar usuario', responses: { 200: exito({ type: 'object' }), ...errores(400, 401, 403, 404) } },
      },
      '/admin/recursos': {
        get: {
          tags: ['Módulo 1 · General'], summary: 'Hojas de datos visibles para el rol',
          description: 'Metadatos (campos, tipos, obligatorios, llave, si es editable) que usa el frontend para construir tablas y formularios.',
          responses: { 200: exito({ type: 'array', items: { type: 'object' } }), ...errores(401) },
        },
      },
      '/admin/importaciones': {
        post: {
          tags: ['Módulo 1 · General'], summary: 'Importar Excel, CSV o informe PDF de gastos',
          description:
            'Acepta el libro histórico «Estadísticas MaIE», la plantilla oficial (.xlsx), un CSV de una hoja o el informe PDF ' +
            '«Presupuesto de Gastos - Recursos Administrados» (PSP-GEF-FR-03) de una promoción. El PDF actualiza el corte del mes en ' +
            '«Presupuesto»: ingresos = apropiación definitiva, gastos = comprometido, saldo certificado = Por_CDP; `informe.cambios` ' +
            'compara los valores anteriores con los nuevos. ' +
            'La hoja «Asignación docente» de la plantilla (promoción, semestre de la promoción, docente, componente, curso) crea ' +
            'o reutiliza la oferta de la clase en ese semestre y le asigna el docente; «Beneficios por estudiante» (promoción, ' +
            'identificación, semestre, beneficio) reemplaza los beneficios por semestre de cada estudiante que aparece. ' +
            'Todo o nada: si alguna fila tiene errores no se guarda nada y se devuelven en `error.details.errores` (hoja, fila, mensaje). ' +
            roles(['coordinador']),
          parameters: [
            { name: 'simular', in: 'query', schema: { type: 'boolean' }, description: 'Valida y resume sin guardar' },
            { name: 'recurso', in: 'query', schema: { type: 'string', enum: RECURSOS.filter((r) => r.id !== 'parametros').map((r) => r.id) }, description: 'Hoja destino (solo CSV)' },
          ],
          requestBody: {
            required: true,
            content: { 'multipart/form-data': { schema: { type: 'object', required: ['archivo'], properties: { archivo: { type: 'string', format: 'binary' } } } } },
          },
          responses: {
            200: exito(ref('ResultadoImportacion'), 'Simulación'),
            201: exito(ref('ResultadoImportacion'), 'Importado'),
            ...errores(400, 401, 403),
          },
        },
      },
      '/admin/plantillas': {
        get: {
          tags: ['Módulo 1 · General'], summary: 'Descargar plantilla .xlsx', description: roles(['coordinador']),
          parameters: [{ name: 'datos', in: 'query', schema: { type: 'boolean' }, description: 'Incluir los datos actuales (exportación)' }],
          responses: {
            200: { description: 'Libro Excel', content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } } },
            ...errores(401, 403),
          },
        },
      },
      '/admin/reportes/estadisticas': {
        get: {
          tags: ['Módulo 1 · General'], summary: 'Estadísticas administrativas (RF-ADM-05)',
          description: `Totales, promedios, desviación estándar muestral y porcentajes por sección (incluye tasas de titulación y deserción por promoción) y \`alertas\` del Panel general: evaluación docente, plazos de titulación, corte presupuestal y datos por actualizar. ${roles(['coordinador'])}`,
          responses: { 200: exito({ type: 'object' }), ...errores(401, 403) },
        },
      },
      '/admin/presupuesto/resumen': {
        get: {
          tags: ['Módulo 1 · General'], summary: 'Consolidado presupuestal (último corte por promoción)',
          description: `Incluye ejecución, distribución del saldo, recaudo frente a los ingresos proyectados (punto de equilibrio) y diferencia con el saldo certificado. ${roles(['coordinador'])}`,
          responses: { 200: exito({ type: 'object' }), ...errores(401, 403) },
        },
      },
      ...rutasRecursos,
      '/admin/docentes/me/perfil': {
        get: {
          tags: ['Módulo 1 · Docentes'], summary: 'Perfil del docente autenticado (RF-ADM-06)',
          description: `Incluye su cuenta (identificación, correo, debe_cambiar_password), los cursos en los que participa y los componentes que apoya (calculados de los cursos). ${roles(['docente'])}`,
          responses: { 200: exito(ref('PerfilDocente')), ...errores(401, 403, 404) },
        },
        put: {
          tags: ['Módulo 1 · Docentes'], summary: 'Actualizar el perfil propio',
          description: `Solo cambia los campos enviados. Nombre y afiliación los administra Coordinación; cursos y componentes salen de /me/cursos. ${roles(['docente'])}`,
          requestBody: cuerpo({
            type: 'object',
            properties: Object.fromEntries(
              ['formacion_profesional', 'campo_formacion', 'enlace_perfil', 'titulacion_maxima', 'linea_investigacion']
                .map((c) => [c, { type: 'string', nullable: true }]),
            ),
          }),
          responses: { 200: exito(ref('PerfilDocente')), ...errores(400, 401, 403, 404) },
        },
      },
      '/admin/docentes/me/cursos': {
        post: {
          tags: ['Módulo 1 · Docentes'], summary: 'Registrar un curso en el que participa el docente',
          description: `Crea la oferta (promoción, periodo, curso) si no existe y cuenta de inmediato en «Cursos y docentes por semestre». El periodo debe ser uno de los cuatro semestres de la promoción. ${roles(['docente'])}`,
          requestBody: cuerpo(ref('Participacion')),
          responses: { 201: exito(ref('PerfilDocente')), ...errores(400, 401, 403, 404) },
        },
      },
      '/admin/docentes/me/cursos/{idCurso}': {
        delete: {
          tags: ['Módulo 1 · Docentes'], summary: 'Quitar un curso del docente',
          description: `Si la oferta queda sin docentes, estudiantes ni notas, se elimina. ${roles(['docente'])}`,
          parameters: [{ name: 'idCurso', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: exito(ref('PerfilDocente')), ...errores(401, 403, 404) },
        },
      },
      '/admin/docentes/{id}/perfil': {
        get: {
          tags: ['Módulo 1 · Docentes'], summary: 'Perfil y cursos de un docente', description: roles(['coordinador']),
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: exito(ref('PerfilDocente')), ...errores(401, 403, 404) },
        },
      },
      '/admin/docentes/{id}/cursos': {
        post: {
          tags: ['Módulo 1 · Docentes'], summary: 'Registrar un curso por un docente', description: roles(['coordinador']),
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: cuerpo(ref('Participacion')),
          responses: { 201: exito(ref('PerfilDocente')), ...errores(400, 401, 403, 404) },
        },
      },
      '/admin/docentes/{id}/cursos/{idCurso}': {
        delete: {
          tags: ['Módulo 1 · Docentes'], summary: 'Quitar un curso de un docente', description: roles(['coordinador']),
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'idCurso', in: 'path', required: true, schema: { type: 'integer' } },
          ],
          responses: { 200: exito(ref('PerfilDocente')), ...errores(401, 403, 404) },
        },
      },
      ...ra.paths,
      ...rutasPendientes(),
    },
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['error'] },
            error: { type: 'object', properties: { message: { type: 'string' }, details: {} } },
          },
        },
        Usuario,
        UsuarioEntrada,
        BeneficioSemestre,
        Participacion: {
          type: 'object', required: ['id_cohorte', 'periodo', 'id_clase'],
          properties: { id_cohorte: { type: 'integer' }, periodo: { type: 'string', pattern: '^\d{4}-[AB]$' }, id_clase: { type: 'integer' } },
        },
        PerfilDocente: {
          type: 'object',
          properties: {
            id_docente: { type: 'string', format: 'uuid' }, nombre_completo: { type: 'string' }, afiliacion: { type: 'string', enum: ['UDENAR', 'EXTERNO'] },
            identificacion: { type: 'string' }, email: { type: 'string' }, debe_cambiar_password: { type: 'boolean' },
            cursos: {
              type: 'array',
              items: { type: 'object', properties: { id_curso: { type: 'integer' }, cohorte: { type: 'string' }, periodo: { type: 'string' }, semestre: { type: 'integer' }, clase: { type: 'string' }, componente: { type: 'string' } } },
            },
            componentes: { type: 'array', items: { type: 'string' } },
          },
        },
        ResultadoImportacion: {
          type: 'object',
          properties: {
            formato: { type: 'string', enum: ['estadisticas', 'plantilla', 'csv', 'gastos-pdf'] },
            simulacion: { type: 'boolean' },
            resumen: {
              type: 'array',
              items: { type: 'object', properties: { hoja: { type: 'string' }, filas: { type: 'integer' }, insertados: { type: 'integer' }, actualizados: { type: 'integer' } } },
            },
            parametros: { type: 'array', items: { type: 'string' } },
            advertencias: { type: 'array', items: { type: 'object' } },
            hojasFaltantes: { type: 'array', items: { type: 'string' } },
            informe: { type: 'object', description: 'Solo PDF: promoción, periodo, fecha_corte, áreas del informe y cambios (anterior → nuevo)' },
          },
        },
        ...esquemasRecursos,
        ...ra.schemas,
      },
      responses: {
        E400: respuestaError('Datos inválidos'),
        E401: respuestaError('Sin sesión o token inválido'),
        E403: respuestaError('El rol no tiene acceso'),
        E404: respuestaError('No encontrado'),
        E409: respuestaError('Duplicado o registro relacionado con otros datos'),
        E501: respuestaError('Pendiente de implementación'),
      },
    },
  };
};

module.exports = construir();
