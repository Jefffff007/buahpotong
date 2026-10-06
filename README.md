# 🍉 Buah Potong — Pemesanan Online

Aplikasi pemesanan buah potong: pembeli isi nama + lantai, pilih maksimal 3
buah untuk dicampur dalam satu kotak, lampirkan screenshot bukti bayar, lalu
pesanan masuk ke dashboard penjual secara real-time (pakai Supabase, bukan
`localStorage` lagi — jadi dashboard selalu sinkron di semua perangkat/browser).

## 1. Siapkan Supabase

1. Buat project baru di https://supabase.com (gratis).
2. Buka **SQL Editor** → **New query**, tempel seluruh isi file
   `supabase/schema.sql`, lalu **Run**. Ini akan membuat:
   - tabel `orders` (data pesanan) + realtime diaktifkan,
   - bucket storage `bukti-bayar` (tempat screenshot bukti transfer) yang bisa
     dibaca publik via link.
3. Buka **Project Settings → API**, salin:
   - **Project URL** → jadi `VITE_SUPABASE_URL`
   - **anon public key** → jadi `VITE_SUPABASE_ANON_KEY`

> Dashboard sekarang dikunci: hanya pemegang akun login yang bisa melihat
> daftar pesanan, mengubah status, menghapus, dan melihat screenshot bukti
> bayar. Pembeli tetap bisa memesan tanpa akun — mereka hanya boleh membuat
> pesanan baru, tidak bisa membaca data pesanan siapa pun.

### Buat akun login untuk dashboard (cuma kamu)

1. Di Supabase Dashboard, buka **Authentication → Providers**, pastikan
   **Email** aktif, lalu matikan **"Allow new users to sign up"** supaya
   orang lain tidak bisa daftar sendiri.
2. Buka **Authentication → Users → Add user → Create new user**. Isi email
   dan password kamu, lalu centang **Auto Confirm User** (supaya tidak perlu
   verifikasi email).
3. Simpan email & password itu — itu yang dipakai untuk masuk ke tab
   **Dashboard** di aplikasi.

## 2. Jalankan di komputer (opsional, untuk coba dulu)

```bash
npm install
cp .env.example .env
# lalu isi .env dengan URL & anon key dari langkah 1
npm run dev
```

Buka link yang muncul di terminal (biasanya `http://localhost:5173`).

## 3. Push ke GitHub

```bash
git init
git add .
git commit -m "Buah potong app"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

Ganti `USERNAME/NAMA-REPO` dengan repo GitHub kamu sendiri.
File `.env` **tidak** ikut ter-push (sudah ada di `.gitignore`) — kuncinya
diisi lewat Environment Variables di Vercel pada langkah berikutnya.

## 4. Deploy ke Vercel

1. Masuk ke https://vercel.com → **Add New… → Project** → import repo GitHub
   yang baru dipush.
2. Vercel otomatis mendeteksi ini project Vite — biarkan default
   (`npm run build`, output folder `dist`).
3. Sebelum klik Deploy, buka **Environment Variables**, tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (nilainya sama seperti isi `.env` di langkah 1).
4. Klik **Deploy**. Setelah selesai, Vercel kasih link aplikasinya — itu yang
   dibagikan ke pembeli dan penjual.

Kalau nanti ganti nilai env var di Vercel, perlu **Redeploy** supaya kebaca
(env var Vite di-bake saat build, bukan saat runtime).

## Struktur proyek

```
index.html              markup halaman
src/main.js             semua logika: form, pilih buah, upload bukti, dashboard, realtime
src/style.css           tema terang bernuansa buah + efek glass
src/supabaseClient.js   koneksi ke Supabase (baca dari env var)
public/bg.mp4           video latar (sudah dikompres & dibisukan)
public/poster.jpg       gambar awal sebelum video termuat
supabase/schema.sql     skrip tabel, kebijakan akses, dan bucket storage
```

## Siapa bisa akses apa

| | Tab Pesan (pembeli) | Tab Dashboard (kamu) |
|---|---|---|
| Lihat daftar pesanan | ❌ tidak bisa | ✅ setelah login |
| Lihat screenshot bukti bayar | ❌ tidak bisa | ✅ setelah login |
| Buat pesanan baru | ✅ tanpa login | — |
| Ubah status / hapus pesanan | ❌ tidak bisa | ✅ setelah login |

Ini ditegakkan di server lewat Row Level Security Supabase, bukan cuma
disembunyikan di tampilan — jadi walau seseorang tahu cara memanggil API-nya
langsung, mereka tetap tidak bisa membaca atau mengubah data tanpa login.

## Tentang bug "hapus pesanan lalu tidak update"

Versi sebelumnya (artifact) kadang menyimpan data hanya di satu
browser/perangkat, sehingga perubahan di satu sisi tidak otomatis muncul di
sisi lain. Versi Supabase ini sudah tidak begitu: setiap ada insert / update /
delete pada tabel `orders`, semua dashboard yang sedang terbuka (di perangkat
mana pun) langsung menarik ulang data lewat Realtime milik Supabase — jadi
begitu dihapus, langsung hilang di semua tempat, bukan hanya di layar yang
menghapusnya.
