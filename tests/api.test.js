'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sakuarab-api-test-'));
process.env.DB_PATH = path.join(testDir, 'test.sqlite');
process.env.NODE_ENV = 'test';

const app = require('../src/app');
const { closeDatabase } = require('../src/db');

after(() => {
  closeDatabase();
  fs.rmSync(testDir, { recursive: true, force: true });
});

test('GET /health mengembalikan status sehat', async () => {
  const response = await request(app).get('/health').expect(200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.status, 'healthy');
});

test('GET /api/words mengembalikan daftar kata beserta metadata', async () => {
  const response = await request(app).get('/api/words').expect(200);
  assert.equal(response.body.success, true);
  assert.ok(response.body.data.length > 0);
  assert.ok(response.body.meta.total >= response.body.data.length);
  assert.ok(response.body.data[0].id);
});

test('pencarian menemukan arti berbahasa Indonesia', async () => {
  const response = await request(app).get('/api/words/search?q=komputer').expect(200);
  assert.ok(response.body.data.some((word) => word.meaning.toLowerCase().includes('komputer')));
});

test('pencarian Arab tanpa harakat tetap menemukan kata', async () => {
  const response = await request(app).get('/api/words/search?q=حاسوب').expect(200);
  assert.ok(response.body.data.some((word) => word.arabic.includes('حَاسُوب')));
});

test('pencarian menolak query kosong', async () => {
  const response = await request(app).get('/api/words/search').expect(400);
  assert.equal(response.body.success, false);
});

test('pencarian mendukung filter jurusan dan limit', async () => {
  const response = await request(app).get('/api/words/search?q=a&major=RPL&limit=2').expect(200);
  assert.ok(response.body.data.length <= 2);
  assert.ok(response.body.data.every((word) => word.major === 'RPL'));
});

test('limit tidak valid ditolak', async () => {
  const response = await request(app).get('/api/words?limit=9999').expect(400);
  assert.equal(response.body.success, false);
});
