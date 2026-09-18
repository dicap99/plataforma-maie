const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const db = require('./config/db');
const apiV1 = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());
if (env.nodeEnv !== 'test') app.use(morgan('dev'));

app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ status: 'success', timestamp: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', error: 'Database connection failed' });
  }
});

app.use('/api/v1', apiV1);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
