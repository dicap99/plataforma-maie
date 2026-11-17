require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  // Clave de las huellas anónimas del EE (Módulo 3). Si cambia, las constancias del semestre abierto dejan
  // de reconocerse y los estudiantes podrían volver a evaluar: fijarla una vez por instalación.
  evalSecreto: process.env.EVAL_SECRETO || process.env.JWT_SECRET || 'dev-only-secret',
  bcryptCost: 10,
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

module.exports = env;
