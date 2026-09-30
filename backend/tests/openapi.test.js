process.env.NODE_ENV = 'test';

jest.mock('../src/config/db', () => ({ pool: {}, query: jest.fn(), withTransaction: jest.fn() }));

const request = require('supertest');
const SwaggerParser = require('@apidevtools/swagger-parser');
const app = require('../src/app');
const openapi = require('../src/docs/openapi');
const { RECURSOS } = require('../src/modules/admin/recursos/recursos.definicion');

describe('Documentación OpenAPI', () => {
  it('es una especificación OpenAPI 3 válida', async () => {
    await expect(SwaggerParser.validate(structuredClone(openapi))).resolves.toBeDefined();
  });

  it('documenta el CRUD de cada hoja del Módulo 1', () => {
    for (const r of RECURSOS) {
      expect(openapi.paths[`/admin/${r.id}`]).toBeDefined();
      const conLlave = `/admin/${r.id}/${r.llave.map((k) => `{${k}}`).join('/')}`;
      expect(Object.keys(openapi.paths[conLlave])).toEqual(expect.arrayContaining(['get', 'put', 'delete']));
    }
  });

  it('marca obligatorios según la definición del recurso', () => {
    const esquema = openapi.components.schemas.CohortesEntrada;
    expect(esquema.required).toEqual(expect.arrayContaining(['nombre', 'periodo_inicio', 'graduados']));
    expect(esquema.properties.periodo_inicio.pattern).toBe('^\\d{4}-[AB]$');
  });

  it('sirve Swagger UI y el JSON', async () => {
    expect((await request(app).get('/api/docs/openapi.json')).body.openapi).toBe('3.0.3');
    const ui = await request(app).get('/api/docs/');
    expect(ui.status).toBe(200);
    expect(ui.text).toMatch(/swagger-ui/);
  });
});
