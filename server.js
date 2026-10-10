'use strict';

require('dotenv').config();

const app = require('./src/app');
const { closeDatabase } = require('./src/db');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT harus berupa angka antara 1 dan 65535.');
}

const server = app.listen(PORT, () => {
  console.log(`SakuArab API berjalan di http://localhost:${PORT}`);
  console.log(`Dokumentasi ringkas: http://localhost:${PORT}/`);
});

function shutdown(signal) {
  console.log(`\nMenerima ${signal}; menutup server...`);
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
