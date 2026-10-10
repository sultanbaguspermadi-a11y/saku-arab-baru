'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { db, DB_PATH, replaceWords, closeDatabase } = require('../src/db');

function toCanonicalWords(parsed) {
  // Format utama SakuArab: { "RPL": [[arabic, latin, meaning, category, example_ar, example_id], ...], ... }
  if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
    const result = [];
    const skippedSections = [];
    for (const [major, entries] of Object.entries(parsed)) {
      // words.json SakuArab juga memuat tabel pasangan Mirip dan metadata _meta;
      // keduanya bukan daftar kosakata enam kolom.
      if (major === 'Mirip' || major.startsWith('_')) {
        skippedSections.push(major);
        continue;
      }
      if (!Array.isArray(entries)) {
        throw new Error(`Bagian "${major}" harus berupa array kosakata.`);
      }
      entries.forEach((entry, index) => {
        if (!Array.isArray(entry) || entry.length < 6) {
          throw new Error(`Entri ${index + 1} pada bagian "${major}" harus memiliki 6 kolom.`);
        }
        result.push({
          major,
          arabic: entry[0],
          latin: entry[1],
          meaning: entry[2],
          category: entry[3],
          example_ar: entry[4],
          example_id: entry[5]
        });
      });
    }
    if (skippedSections.length) {
      console.log(`Bagian metadata/non-kosakata dilewati: ${skippedSections.join(', ')}`);
    }
    return result;
  }

  // Format alternatif: array berisi objek dengan nama bidang API.
  if (Array.isArray(parsed)) {
    return parsed.map((entry) => {
      if (Array.isArray(entry) && entry.length >= 7) {
        const [major, arabic, latin, meaning, category, example_ar, example_id] = entry;
        return { major, arabic, latin, meaning, category, example_ar, example_id };
      }
      return entry;
    });
  }

  throw new Error('Format JSON tidak dikenali. Gunakan objek jurusan seperti words.json SakuArab.');
}

function createBackupIfDatabaseHasData() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM words').get().count;
  if (!count) return null;
  db.pragma('wal_checkpoint(TRUNCATE)');
  const backupDir = path.join(path.dirname(DB_PATH), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `sakuarab-${stamp}.sqlite`);
  fs.copyFileSync(DB_PATH, backupPath);
  return backupPath;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Pemakaian: npm run import:words -- ./words.json');
    process.exitCode = 1;
    return;
  }

  const resolvedPath = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolvedPath)) throw new Error(`File tidak ditemukan: ${resolvedPath}`);
  const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const words = toCanonicalWords(parsed);
  if (!words.length) throw new Error('File tidak berisi kosakata. Database tidak diubah.');

  // Backup sebelum penggantian agar data sebelumnya dapat dipulihkan.
  const backupPath = createBackupIfDatabaseHasData();
  const count = replaceWords(words); // validasi penuh terjadi sebelum DELETE dalam transaksi
  console.log(`Berhasil mengimpor ${count} kosakata dari ${resolvedPath}.`);
  if (backupPath) console.log(`Backup database sebelumnya: ${backupPath}`);
}

try {
  main();
} catch (error) {
  console.error(`Gagal mengimpor: ${error.message}`);
  process.exitCode = 1;
} finally {
  closeDatabase();
}
