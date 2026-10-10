'use strict';

const express = require('express');
const { db } = require('../db');
const { normalizeText } = require('../normalization');

const router = express.Router();
const MAX_LIMIT = 500;

function parsePagination(query, defaultLimit = null) {
  const hasLimit = query.limit !== undefined;
  const hasOffset = query.offset !== undefined;
  const limit = hasLimit ? Number(query.limit) : (hasOffset ? 100 : defaultLimit);
  const offset = hasOffset ? Number(query.offset) : 0;

  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT)) {
    return { error: `Parameter limit harus berupa bilangan bulat 1–${MAX_LIMIT}.` };
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return { error: 'Parameter offset harus berupa bilangan bulat nol atau lebih.' };
  }
  return { limit, offset };
}

function addOptionalFilters(query, params, clauses) {
  if (query.major !== undefined) {
    const major = String(query.major).trim();
    if (!major || major.length > 80) return 'Parameter major tidak valid.';
    clauses.push('LOWER(major) = LOWER(?)');
    params.push(major);
  }
  if (query.category !== undefined) {
    const category = String(query.category).trim();
    if (!category || category.length > 120) return 'Parameter category tidak valid.';
    clauses.push('LOWER(category) = LOWER(?)');
    params.push(category);
  }
  return null;
}

function buildWhere(clauses) {
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

const selectColumns = `id, major, arabic, latin, meaning, category, example_ar, example_id`;

/** GET /api/words — daftar kosakata, dengan filter/pagination opsional. */
router.get('/', (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, null);
    if (pagination.error) {
      return res.status(400).json({ success: false, error: pagination.error });
    }

    const clauses = [];
    const params = [];
    const filterError = addOptionalFilters(req.query, params, clauses);
    if (filterError) return res.status(400).json({ success: false, error: filterError });

    const whereSql = buildWhere(clauses);
    const total = db.prepare(`SELECT COUNT(*) AS total FROM words ${whereSql}`).get(...params).total;
    let sql = `SELECT ${selectColumns} FROM words ${whereSql} ORDER BY major COLLATE NOCASE, category COLLATE NOCASE, arabic COLLATE NOCASE`;
    const listParams = [...params];
    if (pagination.limit !== null) {
      sql += ' LIMIT ? OFFSET ?';
      listParams.push(pagination.limit, pagination.offset);
    } else if (pagination.offset > 0) {
      sql += ' LIMIT ? OFFSET ?';
      listParams.push(100, pagination.offset);
    }
    const data = db.prepare(sql).all(...listParams);

    return res.json({
      success: true,
      data,
      meta: {
        total,
        count: data.length,
        limit: pagination.limit === null && pagination.offset === 0 ? null : (pagination.limit ?? 100),
        offset: pagination.offset
      }
    });
  } catch (error) {
    return next(error);
  }
});

/** GET /api/words/search?q=keyword — cari kata di teks Arab, Latin, arti, kategori, dan contoh. */
router.get('/search', (req, res, next) => {
  try {
    if (typeof req.query.q !== 'string' || !req.query.q.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Parameter q wajib diisi. Contoh: /api/words/search?q=komputer'
      });
    }
    if (req.query.q.length > 100) {
      return res.status(400).json({ success: false, error: 'Panjang keyword maksimal 100 karakter.' });
    }

    const normalizedQuery = normalizeText(req.query.q);
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      return res.status(400).json({ success: false, error: 'Keyword tidak valid setelah dinormalisasi.' });
    }

    const pagination = parsePagination(req.query, 100);
    if (pagination.error) {
      return res.status(400).json({ success: false, error: pagination.error });
    }

    const clauses = tokens.map(() => 'instr(search_text, ?) > 0');
    const params = [...tokens];
    const filterError = addOptionalFilters(req.query, params, clauses);
    if (filterError) return res.status(400).json({ success: false, error: filterError });

    const whereSql = buildWhere(clauses);
    const total = db.prepare(`SELECT COUNT(*) AS total FROM words ${whereSql}`).get(...params).total;
    const data = db.prepare(
      `SELECT ${selectColumns} FROM words ${whereSql}
       ORDER BY CASE WHEN instr(search_text, ?) > 0 THEN 0 ELSE 1 END,
                major COLLATE NOCASE, arabic COLLATE NOCASE
       LIMIT ? OFFSET ?`
    ).all(...params, normalizedQuery, pagination.limit, pagination.offset);

    return res.json({
      success: true,
      query: req.query.q.trim(),
      data,
      meta: { total, count: data.length, limit: pagination.limit, offset: pagination.offset }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
