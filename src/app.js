'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const wordsRouter = require('./routes/words');

const app = express();

const configuredOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: configuredOrigins.includes('*') ? '*' : configuredOrigins,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '32kb' }));

app.get('/', (_req, res) => {
  res.json({
    name: 'SakuArab API',
    status: 'ok',
    endpoints: {
      words: 'GET /api/words',
      search: 'GET /api/words/search?q=keyword',
      health: 'GET /health'
    }
  });
});

app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'healthy' });
});

app.use('/api/words', wordsRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint tidak ditemukan.' });
});

// Error handler umum: tidak mengirim detail internal ke client pada mode produksi.
app.use((error, _req, res, _next) => {
  console.error('[API error]', error);
  const payload = { success: false, error: 'Terjadi kesalahan pada server.' };
  if (process.env.NODE_ENV !== 'production') payload.detail = error.message;
  res.status(500).json(payload);
});

module.exports = app;
