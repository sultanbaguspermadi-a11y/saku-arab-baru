# SakuArab API — Express + SQLite

Backend REST sederhana untuk menyediakan kosakata SakuArab. API menyediakan daftar kata dan pencarian berdasarkan tulisan Arab (dengan/tanpa harakat), transliterasi Latin, arti Bahasa Indonesia, kategori, jurusan, serta contoh kalimat.

> **Catatan data:** proyek ini menyertakan enam kosakata contoh agar API langsung dapat dicoba. Data lengkap perlu diimpor dari `words.json` milik repositori SakuArab. Isi dan kualitas terjemahan kosakata tetap perlu diperiksa oleh guru Bahasa Arab.

## 1. Persyaratan dan instalasi

- Node.js 20 atau lebih baru
- npm

```bash
npm install
npm start
```

Server berjalan di `http://localhost:3000`. Database SQLite otomatis dibuat di `data/sakuarab.sqlite`. Saat database kosong, enam data contoh dimasukkan otomatis.

Mode pengembangan dengan restart saat file berubah:

```bash
npm run dev
```

## 2. Endpoint API

### A. Ambil seluruh daftar kata

```http
GET /api/words
```

Contoh filter:

```http
GET /api/words?major=RPL
GET /api/words?category=Komputer%20dan%20perangkat
GET /api/words?limit=50&offset=0
```

Tanpa `limit`, endpoint menampilkan semua hasil yang sesuai filter. Parameter `limit` menerima 1–500; `offset` dimulai dari 0. Jika memakai `offset` tanpa `limit`, API menggunakan limit 100.

### B. Cari arti/kosakata berdasarkan keyword

```http
GET /api/words/search?q=komputer
GET /api/words/search?q=حاسوب
GET /api/words/search?q=layar&major=RPL
GET /api/words/search?q=mesin&limit=10&offset=0
```

Pencarian memeriksa teks Arab, transliterasi, arti, kategori, jurusan, dan contoh kalimat. Harakat/tanda baca vokal Arab diabaikan; beberapa variasi alif dan ya dinormalisasi. Jika keyword terdiri dari beberapa kata, setiap kata harus ditemukan pada teks pencarian yang sama.

`q` wajib diisi dan maksimal 100 karakter. Maksimum `limit` adalah 500.

### Endpoint pendukung

- `GET /` — ringkasan endpoint
- `GET /health` — pemeriksaan kesehatan server

## 3. Format respons

Contoh respons `GET /api/words/search?q=komputer`:

```json
{
  "success": true,
  "query": "komputer",
  "data": [
    {
      "id": "id-stabil-berbasis-hash",
      "major": "RPL",
      "arabic": "حَاسُوب",
      "latin": "ḥāsūb",
      "meaning": "komputer",
      "category": "Komputer dan perangkat",
      "example_ar": "أَسْتَخْدِمُ الْحَاسُوبَ كُلَّ يَوْمٍ",
      "example_id": "Saya memakai komputer setiap hari"
    }
  ],
  "meta": { "total": 1, "count": 1, "limit": 100, "offset": 0 }
}
```

Bentuk `data` dapat berisi nol, satu, atau banyak objek. Error input mengembalikan status HTTP `400`; endpoint tidak dikenal mengembalikan `404`.

## 4. Impor data lengkap dari repositori SakuArab

Salin `words.json` ke folder backend ini atau berikan path ke file yang sudah ada. Format file asli SakuArab yang didukung:

```json
{
  "RPL": [
    ["حَاسُوب", "ḥāsūb", "komputer", "Komputer dan perangkat", "أَسْتَخْدِمُ الْحَاسُوبَ", "Saya menggunakan komputer"]
  ],
  "Akuntansi": [],
  "TBKR": [],
  "TSM": [],
  "Umum": []
}
```

Jalankan dengan server dihentikan:

```bash
npm run import:words -- ./words.json
```

Atau jika file berada satu folder di atas backend:

```bash
npm run import:words -- ../words.json
```

Skrip akan memvalidasi data terlebih dahulu, melewati bagian `Mirip` dan `_meta` (karena bukan entri kosakata), membuat backup database lama di `data/backups/`, lalu mengganti isi tabel secara transaksional. Bila validasi gagal, penggantian tidak dilakukan. Setiap kata memperoleh ID berbasis hash dari jurusan + lema Arab tanpa harakat (bukan nomor baris), supaya perubahan urutan atau koreksi arti tidak menggeser ID.

## 5. Konfigurasi CORS

Default lokal mengizinkan semua origin (`CORS_ORIGIN=*`). Untuk deployment, salin `.env.example` menjadi `.env` dan isi origin frontend yang diizinkan, misalnya:

```env
PORT=3000
CORS_ORIGIN=https://username.github.io
```

Beberapa origin dapat dipisahkan dengan koma. Server dan skrip impor memuat konfigurasi `.env` secara otomatis melalui `dotenv`. Pada penyedia hosting, variabel tersebut juga dapat diatur langsung dari dashboard.

## 6. Menguji API

```bash
npm test
```

Tes mencakup status server, daftar kata, pencarian arti, pencarian Arab tanpa harakat, validasi query, filter jurusan, dan batas limit.

Atau gunakan curl:

```bash
curl http://localhost:3000/api/words
curl 'http://localhost:3000/api/words/search?q=komputer'
curl 'http://localhost:3000/api/words/search?q=حاسوب&major=RPL'
```

## 7. Menghubungkan frontend

Frontend dapat memanggil endpoint seperti berikut:

```js
const API_URL = 'http://localhost:3000/api';

async function cariKata(keyword) {
  const url = new URL(`${API_URL}/words/search`);
  url.searchParams.set('q', keyword);

  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Pencarian gagal');
  }
  return result.data;
}
```

Ketika frontend sudah di-host, ganti `API_URL` dengan URL backend yang sudah di-deploy. GitHub Pages hanya menyajikan file statis; API Node/Express perlu dijalankan di server/layanan hosting yang mendukung Node.js dan penyimpanan persisten untuk SQLite.

## Struktur proyek

```text
sakuarab-api/
├── data/
│   └── sample-words.json
├── scripts/
│   └── import-words.js
├── src/
│   ├── routes/words.js
│   ├── app.js
│   ├── db.js
│   └── normalization.js
├── tests/api.test.js
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```
