# HYDRIX

Frontend pemerintah dan petani menggunakan React, Vite, MapLibre, dan komponen beUI. Data publik Kementan, CHIRPS, WaPOR v3, dan WorldCereal disimpan sebagai snapshot yang disertai sumber. Data pengamatan dan proyeksi musiman dibedakan dalam UI dan ekspor.

## Menjalankan

```sh
npm install
npm run dev
npm run build
npm test
npm run test:e2e
```

Snapshot awal sudah tersedia di `public/data/`: `majalengka.json` untuk survei dan hujan pengamatan, `environment.json` untuk WaPOR/WorldCereal, dan `projections.json` untuk proyeksi. Browser membaca snapshot terakhir, bukan menjalankan ekstraksi raster. Halaman publik petani berada pada `/?view=petani`.

## Pembaruan sumber dan model

Node.js 22 dan Python 3 diperlukan. Python hanya memakai standard library untuk transport HTTP NOAA; model dan ekstraksi raster berjalan di Node.

```sh
npm run data:base          # poligon Kementan dan 12 bulan CHIRPS terbaru yang tersedia
npm run data:environment   # ET aktual, ET referensi, dan WorldCereal
npm run data:history       # seri CHIRPS 1991–2024 melalui NOAA ERDDAP
npm run data:project       # model lokal; tanpa panggilan LLM
npm run data:ai            # penjelasan Gemini opsional
```

`npm run data:sync` menjalankan seluruh urutan tersebut. Pembaruan dapat gagal jika penyedia membatasi HTTP atau tidak tersedia. Penulisan snapshot memakai file sementara dan rename; data gagal tidak diganti angka buatan. Cache ekstraksi berada di `.cache/` dan tidak dipublikasikan. Snapshot lingkungan/proyeksi hanya dimuat jika mengacu pada versi snapshot dasar yang sama.

Arsip COG UCSB menolak sebagian permintaan selama impor riwayat. Pipeline riwayat memakai mirror CHIRPS v2 NOAA dengan satu permintaan subset. Sebanyak 930 nilai tumpang tindih diperiksa terhadap hasil COG UCSB. Dataset NOAA yang diperiksa tersedia sampai Februari 2025, sehingga seri tahunan lengkap yang digunakan adalah 1991–2024. Model juga memakai 12 bulan pengamatan terbaru dalam snapshot dasar. Ada 420 observasi bulanan per piksel, dengan celah Januari–Agustus 2025; tidak diklaim sebagai seri waktu kontinu tanpa celah.

## Proyeksi 12 bulan

Proyeksi berlaku untuk 12 bulan penuh setelah bulan penerbitan, memakai zona waktu Asia/Makassar. Snapshot awal memproyeksikan November 2026–Oktober 2027. Ini adalah perkiraan pola hujan bulanan berbasis statistik, bukan ramalan cuaca harian, prakiraan atmosfer dinamis, atau produk resmi BMKG.

Dua kandidat model dibandingkan: median per bulan kalender dan regresi harmonik ridge. Pemilihan memakai hindcast 2010–2014; rentang nominal 80% dikalibrasi memakai galat absolut hindcast 2015–2019; evaluasi berikutnya memakai 2020–2024. Setiap hindcast hanya memakai data sebelum tahun target. Median bulanan terpilih pada seluruh 10 piksel pilot karena regresi tidak mengunggulinya pada tahap pemilihan. Galat evaluasi berkisar 59,5–88,9 mm/bulan dan cakupan rentang aktual 71,7–90%, sehingga keandalannya tetap terbatas. Model tidak menerima prediksi ENSO, suhu laut, atau sirkulasi atmosfer mendatang.

Heat calendar menampilkan satu bentang tahun. Warna per tanggal mengacu pada total bulan yang sama; tooltip proyeksi menyertakan batas bawah dan atas. Merah menandakan hujan relatif rendah, kuning sedang, biru tinggi. Warna bukan kategori kekeringan atau risiko tanaman.

## Penjelasan Gemini

Salin `.env.example` menjadi `.env.local`, isi `GEMINI_API_KEY` dan model yang tersedia pada akun, lalu jalankan `npm run data:ai`. Kredensial hanya dibaca skrip lokal; jangan memakai awalan `VITE_` untuk API key. Environment saat implementasi belum memiliki key, sehingga pemanggilan Gemini langsung belum diuji dan UI tidak mengaku memiliki ringkasan Gemini.

Gemini hanya menjelaskan hasil model yang sudah dihitung. Gemini tidak menentukan atau mengubah angka proyeksi. Respons diperiksa: bulan harus berasal dari proyeksi, tindakan harus berasal dari enum peninjauan, dan ringkasan tidak boleh menghasilkan digit atau angka baru. Tanpa key, ringkasan statistik tetap tampil tanpa teks AI palsu. Tes kontrak provider memakai respons terkontrol; bukan pengganti pengujian API langsung.

## Sumber dan batas pemakaian

- Kementan `BawangMerah/MapServer/0` dan `Hortikultura/MapServer/0`: 106 poligon yang lolos pemeriksaan (105 bawang merah, satu bawang daun). Nama pemilik, petani, dan petugas tidak diminta. Kabupaten dinormalisasi dengan trim/case/spasi; salah ketik tidak digabung otomatis. Koordinat diperiksa terhadap kotak geografis sekitar Majalengka, bukan batas administrasi kabupaten.
- Atribut survei berasal dari 2019. Tanggal tidak ditampilkan di popover, tetapi tetap tersedia di sumber dan ekspor. Luas merupakan perhitungan geometri sferis, bukan luas tanam yang dilaporkan.
- CHIRPS v2: hujan pengamatan September 2025–Agustus 2026, piksel native 0,05° di pusat bounding box poligon. Lokasi dalam piksel yang sama berbagi nilai; bukan rerata poligon atau sensor kebun. Nilai nodata tetap null.
- WaPOR v3: raster resmi di bucket publik FAO, setelah API katalog mengembalikan HTTP 403. `L1-AETI-D` adalah ET aktual rata-rata mm/hari dalam dekad, skala raster 0,1 dan grid 0,0029296875°. `L1-RET-E` adalah ET referensi harian, skala 0,1 dan grid regional 0,3125° × 0,25°. Periode terakhir awal ialah 1–10 Oktober 2026 untuk AETI dan 12 Oktober 2026 untuk RET. Periode berbeda tidak dipakai menghitung rasio atau neraca air langsung. Keduanya bukan kelembapan tanah.
- WorldCereal: STAC dan endpoint titik publik Terrascope, item `8023_tc-annual_temporarycrops_2021`. Klasifikasi 0/100 dan confidence kelas pada piksel 10 m hanya memberi konteks historis 2021, bukan jenis bawang, kondisi terkini, atau keputusan kelayakan lahan.
- Record bawang putih yang ditemukan berisi atribut uji; tidak dipakai sebagai bukti kelayakan. Tiga profil Allium tetap memerlukan data tanah, elevasi, varietas, air operasional, dan OPT. Rencana wilayah mengurutkan kebutuhan verifikasi, bukan menetapkan penerima bantuan.

Kelembapan tanah, NDVI, anggaran, dan penerima bantuan belum tersedia. Tidak ada deployment cloud atau integrasi GEE berautentikasi. Peta memakai OpenStreetMap dengan attribution. GPS opt-in tidak disimpan dan dicocokkan terhadap poligon, bukan titik terdekat. Ekspor menyertakan sumber, tanggal survei, lingkungan, metode proyeksi, hasil evaluasi, serta batas pemakaian.

Sumber beUI berada di `components/` dan `lib/`. Heat calendar mendapat opsi palet dan pengecualian tanggal tanpa data. Alias `@/` menunjuk root frontend. Tes browser memakai Chrome terpasang di macOS; sesuaikan `playwright.config.ts` pada mesin lain. Build masih memiliki peringatan ukuran bundle yang besar.
