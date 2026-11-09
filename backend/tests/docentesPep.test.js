jest.mock('../src/config/db', () => ({ pool: {}, query: jest.fn() }));
const { esInstitucion } = require('../scripts/docentesPep');

describe('Carga del directorio docente desde el PEP', () => {
  it('reconoce como institución solo una línea sin títulos ni profesiones', () => {
    for (const t of ['ESPOL', 'Universidad de los Andes', 'UNAD', 'Saturday.ai', 'PTI']) expect(esInstitucion(t)).toBe(true);
    for (const t of [
      'Doctor en Ingeniería (2016)', 'Físico, Universidad del Cauca', 'MSc in Robotics', 'PhD Electrical Engineering',
      'Especialista en Redes', 'Maestría en Control', 'Tecnólogo en Electrónica', 'Ingeniero Electrónico\nMagíster',
      '', null,
    ]) expect(esInstitucion(t)).toBe(false);
  });
});
