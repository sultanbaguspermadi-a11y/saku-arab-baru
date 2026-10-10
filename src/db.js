'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const { buildSearchText, normalizeText } = require('./normalization');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DATA_DIR, 'sakuarab.sqlite');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS words (
    id TEXT PRIMARY KEY,
    major TEXT NOT NULL,
    arabic TEXT NOT NULL,
    latin TEXT NOT NULL DEFAULT '',
    meaning TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    example_ar TEXT NOT NULL DEFAULT '',
    example_id TEXT NOT NULL DEFAULT '',
    search_text TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_words_major ON words(major);
  CREATE INDEX IF NOT EXISTS idx_words_category ON words(category);
`);

const insertWordStatement = db.prepare(`
  INSERT INTO words (
    id, major, arabic, latin, meaning, category, example_ar, example_id, search_text
  ) VALUES (
    @id, @major, @arabic, @latin, @meaning, @category, @example_ar, @example_id, @search_text
  )
  ON CONFLICT(id) DO UPDATE SET
    major = excluded.major,
    arabic = excluded.arabic,
    latin = excluded.latin,
    meaning = excluded.meaning,
    category = excluded.category,
    example_ar = excluded.example_ar,
    example_id = excluded.example_id,
    search_text = excluded.search_text
`);

function makeWordId(word) {
  // ID stabil tidak bergantung pada urutan, harakat, transliterasi, atau koreksi arti.
  // Kombinasi jurusan + lema Arab tanpa harakat unik pada bank kata SakuArab saat ini.
  const identity = `${String(word.major ?? '').trim()}\0${normalizeText(word.arabic)}`;
  return crypto.createHash('sha256').update(identity, 'utf8').digest('hex').slice(0, 24);
}

function validateWord(input, index = 0) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`Entri ke-${index + 1} bukan objek kosakata yang valid.`);
  }

  const word = {
    major: String(input.major ?? '').trim(),
    arabic: String(input.arabic ?? '').trim(),
    latin: String(input.latin ?? '').trim(),
    meaning: String(input.meaning ?? '').trim(),
    category: String(input.category ?? '').trim(),
    example_ar: String(input.example_ar ?? '').trim(),
    example_id: String(input.example_id ?? '').trim()
  };

  if (!word.major || !word.arabic || !word.meaning) {
    throw new Error(`Entri ke-${index + 1} wajib memiliki major, arabic, dan meaning.`);
  }
  if (word.major.length > 80 || word.arabic.length > 300 || word.meaning.length > 500) {
    throw new Error(`Entri ke-${index + 1} melebihi batas panjang bidang.`);
  }

  word.id = makeWordId(word);
  word.search_text = buildSearchText(word);
  return word;
}

const insertValidatedWords = db.transaction((words, replace = false) => {
  if (replace) db.prepare('DELETE FROM words').run();
  for (const word of words) insertWordStatement.run(word);
  return words.length;
});

function upsertWords(words) {
  const validated = words.map((word, index) => validateWord(word, index));
  return insertValidatedWords(validated, false);
}

function replaceWords(words) {
  if (!Array.isArray(words) || words.length === 0) {
    throw new Error('Data impor harus berupa daftar kosakata yang tidak kosong.');
  }
  // Validasi seluruh data SEBELUM transaksi penggantian agar data lama aman bila ada kesalahan.
  const validated = words.map((word, index) => validateWord(word, index));
  return insertValidatedWords(validated, true);
}

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM words').get().count;
  if (count > 0) return;
  const samplePath = path.join(DATA_DIR, 'sample-words.json');
  const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  upsertWords(sample);
  console.log(`Database kosong; ${sample.length} kosakata contoh dimasukkan.`);
}

seedIfEmpty();

function closeDatabase() {
  if (db.open) db.close();
}

module.exports = { db, DB_PATH, validateWord, upsertWords, replaceWords, closeDatabase };
