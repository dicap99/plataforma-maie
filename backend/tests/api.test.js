process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/config/db', () => ({
  pool: {},
  query: jest.fn().mockResolvedValue({ rows: [{ now: '2026-09-17T00:00:00.000Z' }] }),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const tokenPara = (rol) => jwt.sign({ sub: 'usuario-prueba', rol }, 'test-secret', { expiresIn: '1h' });

describe('API MaIE — esqueleto', () => {
  it('GET /api/health responde success', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('ruta protegida sin token → 401', async () => {
    const res = await request(app).get('/api/v1/admin/cohortes');
    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
  });

  it('estudiante sobre ruta de coordinación → 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/presupuesto/resumen')
      .set('Authorization', `Bearer ${tokenPara('estudiante')}`);
    expect(res.status).toBe(403);
  });

  it('rol permitido sobre endpoint pendiente (módulo 3) → 501', async () => {
    const res = await request(app)
      .get('/api/v1/eval-docente/periodos')
      .set('Authorization', `Bearer ${tokenPara('coordinador')}`);
    expect(res.status).toBe(501);
  });

  it.each(['/api/v1/ra/rubricas', '/api/v1/ra/evaluaciones?curso=1', '/api/v1/ra/reportes', '/api/v1/admin/cursos'])(
    'estudiante no consulta resultados de aprendizaje: %s → 403',
    async (ruta) => {
      const res = await request(app).get(ruta).set('Authorization', `Bearer ${tokenPara('estudiante')}`);
      expect(res.status).toBe(403);
    },
  );

  it('calificación fuera de 0–5 → 400 antes de tocar la base de datos', async () => {
    const res = await request(app)
      .post('/api/v1/ra/evaluaciones')
      .set('Authorization', `Bearer ${tokenPara('docente')}`)
      .send({ id_curso: 1, calificaciones: [{ id_estudiante: '6f1c1a52-8d0b-4f7e-9a51-3f0c2a7d9b10', id_criterio: 1, calificacion: 5.01 }] });
    expect(res.status).toBe(400);
  });

  it('coordinación no registra calificaciones de rúbrica (las registra el docente) → 403', async () => {
    const res = await request(app)
      .post('/api/v1/ra/evaluaciones')
      .set('Authorization', `Bearer ${tokenPara('coordinador')}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('agrupación de reporte desconocida → 400', async () => {
    const res = await request(app)
      .get('/api/v1/ra/reportes?agrupar=profesor')
      .set('Authorization', `Bearer ${tokenPara('coordinador')}`);
    expect(res.status).toBe(400);
  });

  it('login con datos inválidos → 400', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'no-es-email' });
    expect(res.status).toBe(400);
  });

  it('ruta inexistente → 404', async () => {
    const res = await request(app).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
  });
});
