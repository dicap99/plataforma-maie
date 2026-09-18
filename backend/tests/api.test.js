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

  it('rol permitido sobre endpoint pendiente (módulo 2) → 501', async () => {
    const res = await request(app)
      .get('/api/v1/ra/reportes')
      .set('Authorization', `Bearer ${tokenPara('coordinador')}`);
    expect(res.status).toBe(501);
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
