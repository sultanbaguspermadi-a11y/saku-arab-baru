'use strict';

/**
 * Normalisasi teks untuk pencarian lintas bahasa.
 * Menghilangkan harakat/tanda gabung, menyederhanakan variasi alif dan ya Arab,
 * serta mengubah teks Latin menjadi lowercase tanpa diakritik.
 */
function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0640]/g, '') // tatweel/kashida
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627') // آ أ إ ٱ -> ا
    .replace(/\u0624/g, '\u0648') // ؤ -> و
    .replace(/\u0626/g, '\u064a') // ئ -> ي
    .replace(/\u0649/g, '\u064a') // ى -> ي
    .replace(/\p{M}/gu, '') // harakat Arab dan diakritik Latin
    .toLocaleLowerCase('id-ID')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchText(word) {
  return normalizeText([
    word.arabic,
    word.latin,
    word.meaning,
    word.category,
    word.example_ar,
    word.example_id,
    word.major
  ].filter(Boolean).join(' '));
}

module.exports = { normalizeText, buildSearchText };
