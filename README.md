# HYDRIX

HYDRIX membantu petani dan pemerintah membaca kondisi lahan, pola hujan, serta kandidat tanam hortikultura musiman. Pilot awal berada di Majalengka, Jawa Barat, dengan fokus bawang merah, bawang daun, dan bawang putih. Ketiganya merupakan kandidat yang perlu dinilai kesesuaiannya; aplikasi belum menetapkan semuanya layak ditanam pada setiap lokasi.

## Brief proyek

Petani mendapat halaman publik yang ramah ponsel, tanpa login, untuk membaca ringkasan lokasi, proyeksi hujan, dan kandidat tanam. Pemerintah mendapat peta dengan poligon lahan. Klik lokasi membuka popover berisi konteks lingkungan, kalender hujan, kandidat komoditas, serta rekomendasi tindakan verifikasi. Perencanaan seluruh lokasi dapat dibuka dari popover untuk meninjau kebutuhan wilayah.

Tujuan proyek adalah membantu perencanaan berbasis bukti. Rekomendasi saat ini mendukung peninjauan oleh penyuluh, bukan menetapkan penerima bantuan atau menjamin hasil panen.

## Status implementasi

| Bagian | Status saat ini |
| --- | --- |
| UI pemerintah dan petani | Sudah tersedia; peta, popover, kalender, kandidat, sumber, dan ekspor JSON |
| Data lahan | 106 poligon survei Kementan yang lolos pemeriksaan di pilot Majalengka |
| Hujan historis | CHIRPS v2; 12 bulan pengamatan pada snapshot awal dan riwayat untuk model |
| Proyeksi hujan | 12 bulan mendatang, model statistik lokal dengan evaluasi historis dan rentang ketidakpastian |
| Konteks air | WaPOR v3: ET aktual dan ET referensi, dengan periode serta resolusi masing-masing |
| Konteks tutupan lahan | WorldCereal 2021, klasifikasi tanaman semusim dan confidence kelas |
| Gemini | Integrasi penjelasan tersedia; panggilan API langsung belum diuji karena API key belum dikonfigurasi |
| NDVI dan kelembapan tanah | Belum terintegrasi |
| Backend dan deployment | Belum tersedia; aplikasi membaca snapshot publik dari berkas JSON |

Data nyata disimpan sebagai snapshot agar UI dapat dijalankan tanpa kredensial. Browser tidak mengambil raster atau memanggil Gemini secara langsung. Snapshot tidak berarti data diperbarui otomatis; pembaruan memerlukan pipeline sinkronisasi.

## Menjalankan lokal

Gunakan Node.js 22 dan npm. Python 3 diperlukan untuk pembaruan riwayat CHIRPS, bukan untuk membuka UI.

```sh
cd apps/web
npm ci
npm run dev
```

- Pemerintah: `http://localhost:5173/`
- Petani: `http://localhost:5173/?view=petani`

Snapshot awal sudah disertakan di `apps/web/public/data/`. Tidak perlu API key untuk mencoba UI dengan snapshot tersebut.

```sh
npm test
npm run build
npm run test:e2e
```

Tes browser memerlukan server lokal yang berjalan. Konfigurasi saat ini menunjuk Chrome di macOS; sesuaikan `apps/web/playwright.config.ts` untuk mesin lain.

## Struktur proyek

```text
apps/web/
  src/                  Halaman, peta, panel lingkungan, proyeksi, dan kontrak data
  components/           Komponen UI beUI dan heat calendar
  scripts/              Sinkronisasi sumber, ekstraksi raster, model, dan Gemini
  public/data/          Snapshot lahan, lingkungan, dan proyeksi
  tests/                Tes interaksi browser
  README.md             Detail metode, pembaruan data, dan batas penggunaan
docs/superpowers/       Desain awal, rencana implementasi, dan catatan perkembangan
```

Stack: React 19, TypeScript, Vite, Tailwind CSS, MapLibre GL, beUI, Vitest, dan Playwright. Implementasi saat ini menjadi acuan status fitur; dokumen desain awal dapat memuat rencana yang belum dibangun.

## Data dan pembaruan

Sumber utama:

- [Geoportal Kementan](https://geoportal.pertanian.go.id/arcgis/rest/services): geometri dan atribut survei.
- [CHIRPS](https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY): konteks hujan historis. Pipeline saat ini memakai raster bulanan UCSB dan mirror NOAA ERDDAP.
- [WaPOR](https://www.fao.org/in-action/remote-sensing-for-water-productivity/en): evapotranspirasi melalui raster publik FAO.
- [WorldCereal](https://esa-worldcereal.org/): konteks tanaman semusim historis melalui Terrascope.

Dari `apps/web`, jalankan `npm run data:sync` untuk seluruh urutan pembaruan. Perintah terpisah tersedia: `data:base`, `data:environment`, `data:history`, `data:project`, dan `data:ai`. Sinkronisasi memerlukan jaringan dan bergantung pada ketersediaan sumber. Detail metode ada di [README frontend](apps/web/README.md).

Untuk penjelasan Gemini, salin `apps/web/.env.example` menjadi `apps/web/.env.local`, isi key dan model yang tersedia pada akun, lalu jalankan `npm run data:ai`. Jangan commit kredensial atau memakai awalan `VITE_` untuk API key. Gemini hanya menjelaskan hasil model; angka proyeksi dihitung oleh model statistik.

## To-do untuk partner

Daftar berikut merupakan usulan urutan kerja untuk melanjutkan proyek. Item yang belum dicentang belum selesai.

### Prioritas 1 — Integrasi dan validasi data

- [ ] **Integrasikan NDVI Sentinel-2 SR Harmonized.** Hitung NDVI dari B8 dan B4 pada resolusi 10 m. Saring awan/bayangan; simpan tanggal citra, cakupan piksel valid, serta agregat dalam poligon. Tampilkan belum tersedia jika observasi tidak cukup. Koleksi `MODIS/MOD09GA_006_NDVI` tidak dipilih untuk kondisi terbaru karena berhenti pada Februari 2023.
- [ ] **Validasi data lahan bersama penyuluh.** Perbarui atribut survei 2019, cek batas administrasi, geometri, komoditas, dan kondisi irigasi. Jangan menganggap atribut historis sebagai observasi terkini.
- [ ] **Lengkapi data kesesuaian tiga komoditas.** Cari tanah, elevasi, varietas, kebutuhan air, umur panen, dan OPT dari sumber yang dapat dipertanggungjawabkan. Record bawang putih beratribut uji belum dapat dijadikan bukti kelayakan.
- [ ] **Pilih sumber kelembapan tanah.** Catat unit, kedalaman, waktu, dan resolusi. ET WaPOR tidak boleh ditampilkan sebagai kelembapan tanah.

### Prioritas 2 — Backend, AI, dan pembaruan

- [ ] **Sediakan backend atau job sinkronisasi.** Jalankan ekstraksi di server, simpan cache dan snapshot versi terakhir yang berhasil, serta catat waktu pembaruan dan kegagalan sumber.
- [ ] **Uji Gemini dengan API key server.** Periksa respons nyata, biaya, kuota, dan penanganan kegagalan. Pastikan model tidak mengubah angka proyeksi atau mengarang observasi lapangan.
- [ ] **Evaluasi proyeksi musiman lebih lanjut.** Bandingkan baseline pada data baru; tinjau sumber prakiraan atmosfer atau produk BMKG yang berizin. Pertahankan label ketidakpastian dan pisahkan pengamatan dari proyeksi.
- [ ] **Susun aturan rekomendasi bersama ahli agronomi.** Setiap saran komoditas/tindakan harus memiliki alasan, bukti, dan data yang masih kurang. Uji pada beberapa lokasi sebelum dipakai untuk keputusan operasional.

### Prioritas 3 — Kesiapan rilis

- [ ] Buat konfigurasi tes browser lintas mesin dan CI untuk tes serta build.
- [ ] Kurangi ukuran bundle, terutama pemuatan peta, lalu uji koneksi lambat dan ponsel.
- [ ] Pilih hosting dan siapkan deployment, pengelolaan secrets, serta pemantauan pembaruan data.
- [ ] Tinjau ketentuan penggunaan dan atribusi setiap sumber serta komponen sebelum rilis publik.
- [ ] Uji alur petani dan pemerintah bersama pengguna; dokumentasikan hasil dan perbaikan.

## Batas yang perlu dipahami

- Poligon survei berasal dari 2019. Tanggal tetap tersedia di metadata sumber dan ekspor.
- Piksel CHIRPS sekitar 0,05°; beberapa lahan berbagi piksel. Nilainya bukan pengukuran sensor kebun.
- Proyeksi awal November 2026–Oktober 2027 merupakan pola hujan bulanan berbasis statistik, bukan ramalan cuaca harian atau produk resmi BMKG. Median bulanan terpilih pada seluruh 10 piksel pilot setelah pembandingan historis.
- NDVI, WorldCereal, dan ET memiliki arti berbeda. Tidak ada satu indikator yang cukup untuk memastikan kekeringan, penyakit, atau kelayakan tanam.
- Implementasi belum memiliki login, penyimpanan pengguna, penetapan bantuan, atau deployment produksi.

Lihat [dokumentasi teknis frontend](apps/web/README.md) untuk periode snapshot, resolusi raster, evaluasi model, dan batas interpretasi lebih lengkap.
