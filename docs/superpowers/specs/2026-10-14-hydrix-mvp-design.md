# Desain MVP HYDRIX

Tanggal: 14 Oktober 2026. Dokumen ini mencatat scope yang disepakati dan keputusan teknis yang diusulkan untuk implementasi. Persetujuan scope sebelumnya tidak berarti kode sudah dibuat.

## Tujuan dan batas produk

HYDRIX membantu pemerintah menyusun draft intervensi pertanian dan membantu petani membandingkan kandidat tanam berdasarkan bukti geospasial serta pola musim. Pilot adalah Kabupaten Majalengka. Bawang merah menjadi komoditas dasar; bawang daun dan bawang putih menjadi kandidat bersyarat. Mangga tidak termasuk scope.

Kalender mencakup 12 bulan mulai bulan setelah `analysis_date`. Kalender merupakan skenario musiman berdasarkan histori, bukan prakiraan cuaca atau pengukuran tanah setiap kebun. Sistem boleh menghasilkan satu kandidat, tidak ada kandidat, atau rekomendasi menunda tanam. Ketiga kandidat Allium bukan rotasi otomatis untuk memutus OPT.

MVP tidak mencairkan bantuan, menentukan penerima individu, menghitung anggaran, atau menerbitkan keputusan resmi. Data agronomi yang belum cukup menghasilkan status `insufficient_data`, bukan klaim sesuai. Tidak ada formulir verifikasi lapangan wajib.

## Bukti data yang sudah diperiksa

- Layer BawangMerah memiliki 109 record dengan nama kabupaten Majalengka setelah normalisasi kapitalisasi/spasi. Sebanyak 108 mengisi komoditas, 70 memiliki luas tanam positif, 98 mengisi irigasi, dan 102 mengisi fase tanaman. Tanggal survei yang terisi berasal dari 2019.
- Layer Hortikultura memuat empat record Majalengka: satu bawang merah, satu bawang daun, dan dua mangga. Mangga dikeluarkan. Jumlah lintas-layer bukan jumlah kebun unik sebelum pemeriksaan duplikasi.
- Satu record BawangPutih berlabel Majalengka memiliki nilai `uji` pada varietas dan ketersediaan air. Record ini tidak dipakai sebagai bukti agronomi atau kondisi air valid.
- Garut memiliki 135 record Hortikultura, tetapi hanya 15 memiliki luas tanam positif. Majalengka dipilih untuk kelengkapan dan keragaman kandidat, bukan karena jumlah record terbesar.
- Pusdatin/BPP memiliki 5.340 titik secara nasional. Skema layer yang diperiksa hanya FID, NO, PULAU, dan geometri; nama BPP dan wilayah pelayanan belum terbukti tersedia.
- SaranaPrasarana tidak memberikan record berlabel Majalengka pada hasil pemeriksaan. Ketiadaan record tidak berarti tidak ada sarana.
- Katalog IGT Hortikultura menyebut Majalengka, Indramayu, dan Kuningan, tetapi layanan meminta token. Dataset ini bukan dependensi P0.

Record 2019 digunakan sebagai batas/atribut survei historis. Komoditas, umur tanaman, fase, luas, dan irigasi historis tidak dianggap kondisi sekarang. Salah ketik wilayah tidak dikoreksi secara otomatis tanpa kecocokan geometri dan batas administrasi. Jangan menggunakan label kabupaten sebagai satu-satunya validasi spasial.

## Arsitektur

Frontend React + TypeScript + Vite menggunakan sumber komponen beUI. FastAPI menyajikan API dan hasil build frontend dalam satu layanan Cloud Run agar origin tunggal. Pipeline Python mengekstrak data Kementan dan Earth Engine secara batch. Snapshot JSON/GeoJSON berversi disimpan di Cloud Storage; aplikasi tidak menghubungi Earth Engine ketika pengguna memilih poligon.

MVP memakai filesystem snapshot lokal untuk pengembangan dan snapshot immutable dari Cloud Storage untuk deployment. Tidak memerlukan database, antrean, akun pengguna, atau layanan admin HTTP. Admin menjalankan pipeline melalui CLI dengan kredensial terpisah. Gemini berjalan di backend melalui Google GenAI SDK; ID model ditentukan lewat environment setelah akses dan fitur diuji.

## Data dan perhitungan

- CHIRPS `UCSB-CHG/CHIRPS/DAILY`: curah hujan harian, dijumlahkan per bulan; gunakan klimatologi 1991–2020 dengan syarat minimal 24 tahun lengkap per bulan kalender.
- ERA5-Land `ECMWF/ERA5_LAND/MONTHLY_AGGR`: kelembapan tanah regional lapisan 1 dan 2; baseline 1991–2020. Nilai fraksi volume tidak diubah menjadi persentase risiko tanpa aturan eksplisit.
- Sentinel-2 `COPERNICUS/S2_SR_HARMONIZED`: NDVI bulanan dari B8/B4 setelah masking awan dan bayangan. Ringkasan historis 2019–2025 untuk konteks vegetasi; tidak memprediksi NDVI tanaman yang belum ditanam. Bulan valid membutuhkan minimal tiga pengamatan bebas awan pada minimal 50% piksel poligon.
- Elevasi SRTM `USGS/SRTMGL1_003`: median elevasi poligon untuk penyaringan kandidat; verifikasi katalog dan akses ketika pipeline dikerjakan.
- Batas kabupaten Majalengka: cari layer Hosted/Batas_Administrasi_KabupatenKota, audit field dan kode, lalu simpan geometri terverifikasi. Jangan menukar layer kecamatan menjadi kabupaten.
- Daerah irigasi: overlay menunjukkan ketercakupan wilayah layanan historis. Tidak membuktikan debit, koneksi kebun, atau kondisi operasional sekarang.
- BPP: titik terdekat hanya kandidat koordinasi, dengan ID sumber; tidak diberi nama atau wilayah tanggung jawab yang tidak tersedia.

Gunakan bulan lengkap terbaru per dataset. Simpan `available_through` terpisah; jangan melabeli semua dataset dengan tanggal terbaru Sentinel-2. Nilai hilang tetap null. Tidak ada pemaksaan resolusi CHIRPS/ERA5 menjadi presisi 10 m.

Kalender memakai median/P20/P80 historis per bulan. P20/P80 adalah variasi historis, bukan interval prediksi. Risiko relatif `elevated` hanya jika baseline kelembapan bulan di bawah atau sama dengan P25 dari 12 baseline kelembapan dan baseline hujan di bawah atau sama dengan P25 dari 12 baseline hujan. Jika hanya satu terpenuhi: `watch`; jika keduanya tidak: `typical`; jika input tidak cukup: `unknown`. Ini heuristik demo versi `seasonal-v1`, bukan ambang kekeringan agronomis resmi. NDVI tidak menjadi bukti tunggal kekeringan.

Katalog kandidat mencatat nama ilmiah, famili, metode tanam, hari menuju panen, batas suhu/elevasi/air bila sumber menyediakan, URL sumber, dan status peninjauan. Tidak mengarang batas pH, suhu, air, atau toleransi penyakit. Penyaringan mengecek seluruh durasi tanam; hanya kondisi yang datanya cukup diberi hasil. Tanpa bukti tanah atau air operasional, tampilkan perbandingan iklim bersyarat dan faktor belum diketahui. Peringkat bukan probabilitas keberhasilan.

## Alur pengguna dan UI

Pemerintah membuka peta Majalengka, memilih poligon, memeriksa sumber/tanggal, memilih bulan, menjalankan analisis, membaca kandidat tanam serta draft bantuan, lalu mengekspor laporan. Default wilayah tetap Majalengka; filter kecamatan hanya untuk nama yang telah dinormalisasi dengan bukti.

Petani membuka halaman ringkas dan menekan “Gunakan lokasi saya”. HTTPS dan izin browser diperlukan. Simpan GPS hanya selama sesi dan jangan masukkan koordinat mentah ke log. Cocokkan titik dengan poligon; lokasi pengguna tidak membuktikan kepemilikan atau posisi kebun. Jika di luar pilot, izin ditolak, akurasi buruk, atau tidak cocok, tawarkan pemilihan poligon atau tombol “Gunakan lokasi demo Majalengka”. Peralihan ke demo tidak dilakukan diam-diam.

Komponen beUI yang diperiksa melalui MCP: animated-sidebar, card, tabs, button, combobox, select, table, drawer, bottom-sheet, agent-activity, citations, animated-toast-stack, loader. Salin seluruh file dan dependency yang dikembalikan MCP. Tidak ada package runtime `beui`. Slug halaman `button` bukan bukti slug CLI; jangan menjalankan perintah instalasi tanpa registry live. Registry HTTP mengembalikan 403 pada pemeriksaan awal; jalur MCP tersedia.

Desktop: sidebar, peta utama, panel detail, tabel kalender 12 bulan, panel rekomendasi. Mobile: kartu ringkasan dan bottom sheet detail lokasi. Gunakan Table untuk kalender bulanan dan perbandingan kandidat. Jangan memakai ReturnsCalendar dengan persentase finansial atau PriceTargetFan untuk nilai iklim. AgentActivity menampilkan panggilan tool dan status eksekusi, bukan chain-of-thought. Citations menampilkan evidence yang telah divalidasi. Semua status memakai teks selain warna, kontrol dapat diakses keyboard, dan motion menghormati reduced motion.

## Gemini, laporan, dan kegagalan

Tools read-only: get_location_context, get_historical_indicators, get_seasonal_scenarios, get_infrastructure_context, get_intervention_catalog, get_crop_candidates. Backend menghitung nilai, menyaring kandidat, dan memvalidasi parameter. Gemini menyusun narasi dan memilih intervensi dari katalog; tidak menentukan angka iklim, poligon, atau kandidat baru.

Batas per analisis: maksimal delapan panggilan tool, tiga putaran model, 30 detik total, dan satu percobaan perbaikan schema. Timeout/hasil salah mempertahankan hasil deterministik dengan label “Penjelasan AI belum tersedia”. Output memuat evidence IDs, month YYYY-MM, crop IDs/intervention IDs yang tersedia, status draft, serta keterbatasan. Evidence IDs dan angka keluaran harus cocok dengan snapshot.

Laporan P0 berupa HTML siap cetak/PDF lewat browser dan JSON. Isinya wilayah, snapshot, timestamp, metode, kalender, faktor belum diketahui, draft bantuan, kandidat lokasi koordinasi, dan sumber. Reviewer adalah kolom kosong untuk diisi saat proses resmi, bukan nama pejabat yang dibuat AI.

## Keamanan dan penerimaan

Secrets hanya backend; bucket raw private; snapshot publik memakai whitelist tanpa nama pemilik/petugas/kontak. Teks dari API dianggap data, bukan instruksi. Pengguna hanya memilih ID yang telah terdaftar; backend tidak mengambil URL bebas dari prompt. Rate limit analisis default 10 request per menit per IP, batas payload 16 KiB, dan maksimum 100 poligon per permintaan pemerintah. Aplikasi demo memiliki dua tampilan, bukan dua role otorisasi resmi.

Selesai jika satu poligon nyata yang lolos QC dapat dianalisis, kalender tepat 12 bulan, tiga profil kandidat tersedia dengan status jujur, satu/nihil kandidat ditangani, ekspor memuat evidence, GPS gagal tetap punya fallback berlabel, dan API eksternal/model yang gagal tidak merusak pembacaan snapshot. Klaim pilot siap produksi tidak termasuk penerimaan.

## Referensi

- PRD asal: `/Users/adriyanhazmar/Downloads/gemini-code-1791938429792.md` (terpotong pada bagian MVP operasional).
- https://geoportal.pertanian.go.id/arcgis/rest/services/Hortikultura/MapServer/0
- https://geoportal.pertanian.go.id/arcgis/rest/services/BawangMerah/MapServer/0
- https://geoportal.pertanian.go.id/arcgis/rest/services/BawangPutih/MapServer/0
- https://geoportal.pertanian.go.id/arcgis/rest/services/Pusdatin/BPP/MapServer/0
- https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY
- https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_MONTHLY_AGGR
- https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED
- https://repository.pertanian.go.id/server/api/core/bitstreams/daaa2d89-e48b-4b81-8340-04a1ad3ab56a/content
- https://beui.dev/docs/ai-agents
