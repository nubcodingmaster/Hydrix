# Catatan eksekusi UI

User meminta implementasi dimulai dari UI. Scope tahap ini adalah frontend React dengan data sintetis berlabel, bukan ekstraksi GEE, backend, atau Gemini live. Sumber beUI diambil melalui MCP dengan seluruh helper/dependency. Workspace awal kosong dan tidak memiliki repo Git. Perubahan dikerjakan langsung dalam workspace yang ditunjuk user.

Keputusan: mendahulukan UI dari Task 5 dan 7, serta scaffold frontend Task 1. Kontrak backend dan pipeline tetap belum selesai. Biaya keputusan ini adalah adapter data perlu dihubungkan ketika API tersedia.

## Hasil implementasi

Frontend terdiri dari ringkasan wilayah, peta MapLibre dengan poligon demo, pemilih lahan/bulan, kalender 12 bulan, kandidat tanaman, sumber data, draft rencana aksi, serta mode petani dengan GPS opt-in dan fallback eksplisit. Ekspor JSON dan cetak tersedia. Komponen beUI dipasang sebagai sumber lengkap, termasuk toast. Basemap OpenStreetMap memakai attribution.

Review independen menemukan tiga masalah yang telah direproduksi: pemilih bulan mobile tersembunyi, kontras teks batas data di bawah 4,5, dan status GPS tertinggal setelah pilihan demo manual. Ketiganya diperbaiki dengan tes regresi browser. Panel informasi peta juga tidak lagi menghalangi marker.

Dependency MapLibre diperbarui ke 6.14.0 dan Vitest ke 5.0.4 setelah audit menemukan advisory pada versi awal. Audit setelah instalasi menghasilkan nol kerentanan. Build masih memberi peringatan bundle besar; pemisahan chunk peta dapat dikerjakan pada optimasi berikutnya. Tidak ada perubahan backend, pipeline, kredensial, atau deployment cloud.

Verifikasi final: TypeScript/Vite build sukses; 3/3 tes unit dan 4/4 tes browser lulus. Screenshot desktop/mobile tersimpan di apps/web/tests/screenshots. Server preview lokal tersedia pada http://localhost:5173.

## Integrasi sumber publik — 14 Oktober 2026

Permintaan terbaru mengganti seluruh data UI buatan dengan data sumber. Pipeline `apps/web/scripts/sync-data.mjs` mengambil poligon Kementan dan 12 raster bulanan CHIRPS resmi melalui HTTP Range. Snapshot publik berisi 106 poligon (105 bawang merah, satu bawang daun), 10 piksel CHIRPS berbeda, dan hujan September 2025–Agustus 2026. Tiga record berkoordinat di luar kotak pemeriksaan dan satu record tanpa komoditas terverifikasi disisihkan. Record bawang putih berisi atribut uji tetap tidak menjadi bukti kandidat.

Frontend memakai snapshot tersebut, geometri asli, tanggal survei 2019, dan tanggal ekstraksi. File data buatan dihapus dari runtime/source. UI dan ekspor tidak lagi menggunakan status simulasi, heuristik risiko buatan, atau penundaan analisis palsu. Halaman kalender berubah menjadi hujan historis karena sumber terhubung tidak menyediakan ramalan masa depan. Kelembapan tanah, NDVI, prakiraan, anggaran, dan penerima bantuan tetap null atau ditandai belum tersedia.

Luas dihitung dari geometri sferis, bukan atribut luas tanam dengan satuan yang belum jelas. Rencana wilayah membaca semua lokasi dan mengurutkan kebutuhan verifikasi berdasarkan kelengkapan tanggal/irigasi. Kandidat tanam merujuk jumlah survei; belum ada klaim kesesuaian agronomis terkini. Implementasi ini menyelesaikan penggantian sumber UI dengan ekstraksi publik tanpa kredensial, tetapi belum menyelesaikan GEE berautentikasi, backend/cloud, prakiraan, atau Gemini dari rencana awal.

Tes unit baru memeriksa provenance, konsistensi piksel bersama, nilai null, geometri GPS termasuk lubang, dan cakupan seluruh lokasi pada rencana. Tes browser memeriksa peta nyata, kalender historis, unduhan wilayah, halaman petani mobile, dan kegagalan pemuatan sumber tanpa fallback angka buatan.

Verifikasi integrasi: impor publik berhasil dijalankan ulang termasuk pengecekan atribut bawang putih; build TypeScript/Vite sukses; 4 tes unit dan 3 tes browser lulus. Audit dependency produksi tidak menemukan kerentanan. Screenshot hasil sumber asli tersedia di `apps/web/tests/screenshots/real-map.png`. Peringatan ukuran bundle masih ada. Pembaruan data dijalankan melalui `npm run data:sync`, bukan otomatis saat membuka browser.

## Lingkungan dan proyeksi musiman — 14 Oktober 2026

WaPOR v3 berhasil diambil dari bucket publik resmi FAO karena API katalog mengembalikan HTTP 403. Seluruh 106 lokasi mendapat ET aktual dekad 1–10 Oktober 2026 dan ET referensi harian 12 Oktober 2026; faktor skala 0,1 dibaca dari metadata raster. WorldCereal didapat dari STAC/point API publik Terrascope untuk item AEZ 8023, kelas tanaman semusim dan confidence tahun 2021. Tidak ada klaim bahwa kelas tersebut menunjukkan bawang atau kondisi saat ini.

Impor 35 tahun penuh melalui COG UCSB terhenti akibat HTTP 403. Alternatif mirror resmi NOAA berhasil menyediakan 408 bulan lengkap 1991–2024 dalam satu subset; 930 nilai tumpang tindih sama dengan hasil COG UCSB dalam toleransi 0,2 mm. Ditambah 12 bulan pengamatan terkini, setiap piksel memiliki 420 observasi untuk pemodelan. Celah Januari–Agustus 2025 tidak diisi buatan.

Model membandingkan median bulanan dengan regresi harmonik ridge melalui pemilihan 2010–2014, kalibrasi galat 2015–2019, serta evaluasi 2020–2024. Median terpilih pada 10 piksel. Proyeksi November 2026–Oktober 2027 menyertakan rentang nominal 80%, galat historis 59,5–88,9 mm/bulan, serta cakupan aktual 71,7–90%. UI menyebutnya proyeksi musiman statistik dengan keandalan terbatas, bukan ramalan cuaca harian/resmi. Gemini tidak menghasilkan angkanya.

Integrasi batch Gemini untuk penjelasan proyeksi disiapkan menggunakan API key lokal dan respons terstruktur. Tidak ada key pada environment, sehingga API langsung belum diuji; tidak ada teks yang diklaim sebagai keluaran Gemini. Validasi respons membatasi bulan dan kode tindakan serta menolak ringkasan berdigit. UI menampilkan ringkasan statistik sampai ringkasan Gemini yang valid tersedia.

Tanggal survei dan link poligon dihapus dari popover; provenance tetap di halaman sumber dan ekspor. Footer sidebar dan tombol perencanaan pada header dihapus. Perencanaan masih dapat dibuka dari popover. Kalender popover sekarang menampilkan tahun proyeksi; riwayat pengamatan tetap tersedia pada tab tersendiri.
