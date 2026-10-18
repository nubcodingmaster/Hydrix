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

Buat `.env.local` berisi `GEMINI_API_KEY` dan `GEMINI_MODEL`, lalu jalankan `npm run data:ai`. API key hanya dibaca generator lokal dan tidak boleh memakai awalan `VITE_`. Model harus tersedia pada akun Google AI Studio.

Generator menghasilkan `public/data/analysis.json` untuk analisis petani/pemerintah, tiga kandidat komoditas, usulan air/tanah/pemantauan OPT dan ringkasan hujan per piksel. Proyeksi angka tetap dihitung model statistik. Input menyertakan periode, resolusi, cakupan, nilai yang hilang, serta keterbatasan. Identitas SHA-256 input, versi prompt, model, dan bulan referensi menentukan validitas cache. Browser memeriksa ulang input sebelum menampilkan hasil. Geometri dan titik koordinat tiap lahan tidak dikirim ke Gemini.

Setiap batch disimpan secara atomik setelah validasi struktur dan pemeriksaan klaim. Klaim kesesuaian pasti, atribusi penyebab NDVI, atau aliran air/ET musiman tanpa data ditolak; model diminta mengoreksi hanya bagian bermasalah sebelum hasil diterima. `node scripts/repair-ai-analysis.mjs` juga dapat memeriksa dan mengoreksi snapshot yang sudah ada.  Keluaran yang terpotong, ID/jenis yang tidak lengkap, rujukan bukti tidak dikenal, dan digit dalam narasi ditolak. Jeda antarpermintaan serta retry terbatas menangani HTTP 429/503. Jika kuota tetap membatasi, progres terdahulu dipertahankan. Jalankan perintah yang sama untuk melanjutkan. Tidak ada model pengganti otomatis atau hasil AI buatan. Kegagalan dan cakupan parsial harus ditampilkan sebagai kondisi tersebut.


## Sumber dan batas pemakaian

- Kementan `BawangMerah/MapServer/0` dan `Hortikultura/MapServer/0`: 106 poligon yang lolos pemeriksaan (105 bawang merah, satu bawang daun). Nama pemilik, petani, dan petugas tidak diminta. Kabupaten dinormalisasi dengan trim/case/spasi; salah ketik tidak digabung otomatis. Koordinat diperiksa terhadap kotak geografis sekitar Majalengka, bukan batas administrasi kabupaten.
- Atribut survei berasal dari 2019. Tanggal tidak ditampilkan di popover, tetapi tetap tersedia di sumber dan ekspor. Luas merupakan perhitungan geometri sferis, bukan luas tanam yang dilaporkan.
- CHIRPS v2: hujan pengamatan September 2025–Agustus 2026, piksel native 0,05° di pusat bounding box poligon. Lokasi dalam piksel yang sama berbagi nilai; bukan rerata poligon atau sensor kebun. Nilai nodata tetap null.
- WaPOR v3: raster resmi di bucket publik FAO, setelah API katalog mengembalikan HTTP 403. `L1-AETI-D` adalah ET aktual rata-rata mm/hari dalam dekad, skala raster 0,1 dan grid 0,0029296875°. `L1-RET-E` adalah ET referensi harian, skala 0,1 dan grid regional 0,3125° × 0,25°. Periode terakhir awal ialah 1–10 Oktober 2026 untuk AETI dan 12 Oktober 2026 untuk RET. Periode berbeda tidak dipakai menghitung rasio atau neraca air langsung. Keduanya bukan kelembapan tanah.
- WorldCereal: STAC dan endpoint titik publik Terrascope, item `8023_tc-annual_temporarycrops_2021`. Klasifikasi 0/100 dan confidence kelas pada piksel 10 m hanya memberi konteks historis 2021, bukan jenis bawang, kondisi terkini, atau keputusan kelayakan lahan.
- Record bawang putih yang ditemukan berisi atribut uji; tidak dipakai sebagai bukti kelayakan. Tiga profil Allium tetap memerlukan data tanah, elevasi, varietas, air operasional, dan OPT. Rencana wilayah mengurutkan kebutuhan verifikasi, bukan menetapkan penerima bantuan.

Kelembapan tanah, NDVI, anggaran, dan penerima bantuan belum tersedia. Tidak ada deployment cloud atau integrasi GEE berautentikasi. Peta memakai OpenStreetMap dengan attribution. GPS opt-in tidak disimpan dan dicocokkan terhadap poligon, bukan titik terdekat. Ekspor menyertakan sumber, tanggal survei, lingkungan, metode proyeksi, hasil evaluasi, serta batas pemakaian.

Sumber beUI berada di `components/` dan `lib/`. Heat calendar mendapat opsi palet dan pengecualian tanggal tanpa data. Alias `@/` menunjuk root frontend. Tes browser memakai Chrome terpasang di macOS; sesuaikan `playwright.config.ts` pada mesin lain. Build masih memiliki peringatan ukuran bundle yang besar.

## Earth Engine API integration (16 October 2026)

The interface is now in English. Farmer links use `/?view=farmer`; legacy `/?view=petani` links still work. No manual field-data inputs have been added.

### Authentication and extraction

Cloud project: `rising-guide-511814-p1` (HYDRIX), registered for the noncommercial Earth Engine Community tier without enabling billing. The `hydrix-data-reader` service account has been configured by the user. Live extraction authenticated successfully on 16 October 2026.

Grant that service account only `roles/earthengine.viewer` and `roles/serviceusage.serviceUsageConsumer` on this project. Store its JSON key outside the repository or in the Git-ignored root `.secrets/` directory with owner-only permissions. Never put a key in `public/`, a `VITE_` variable, or chat. Copy `.env.example` to `.env.local`, set `GOOGLE_APPLICATION_CREDENTIALS` to the absolute key path, and run:

```sh
npm run data:earth-engine
```

An already-issued short-lived OAuth token can alternatively be supplied using `EARTH_ENGINE_ACCESS_TOKEN`. Extraction uses the official Earth Engine SDK and maintained Google Auth library with the Earth Engine read-only scope. The SDK's transitive `googleapis` dependency is overridden to a current version to remove vulnerabilities in legacy authentication dependencies. The legacy SDK private-key authentication helper is not used because it uses an obsolete JWT constructor.

The command exits unsuccessfully when credentials, source access, or extraction fail. It writes availability metadata without inventing observations. Previous successful layers are retained only when they match the base snapshot version, and are labeled Cached after a failed refresh. Public snapshots contain no credentials or raw provider errors. The full `data:sync` command stops on Earth Engine failure so missing integrations are not silently reported as successful.

### Sources and methods

- `OpenLandMap/SOL/SOL_PH-H2O_USDA-4C1A2A_M/v02`: modeled soil pH, 250 m; stored raw values divided by 10.
- `OpenLandMap/SOL/SOL_ORGANIC-CARBON_USDA-6A1C_M/v02`: modeled organic carbon, 250 m; stored values multiplied by 5 g/kg.
- `OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02`: modeled USDA texture class, 250 m; polygon mode rather than averaging categorical codes.
- Soil layers retain separate 0, 10 and 30 cm depths, source dates (1950–2018), units, and native scale. These are modeled historical soil maps, not annual observations or a measured 0–30 cm layer.
- `ECMWF/ERA5_LAND/HOURLY`: 30 UTC days before the latest available observation date. Requires at least 648 of 720 distinct hourly timestamps (90% temporal coverage); records actual coverage and missing timestamps without interpolation. Temperature is converted from Kelvin to Celsius. Relative humidity is computed for each hour from temperature and dewpoint using the Magnus formula, then averaged over available hours. Weather samples use the regional pixel at each field bounding-box center because survey polygons are too small for reliable area reduction on this grid. Native scale: approximately 11,132 m. This is recent reanalysis, not a forecast or a calibrated pest model.
- `COPERNICUS/S2_SR_HARMONIZED`: median NDVI from B8/B4 over the latest 30-day window and preceding 30-day window. SCL classes 4, 5 and 6 are retained; clouds, shadows, snow and unclassified pixels are excluded. A pixel needs three valid observations; a polygon needs at least 50% valid coverage. Insufficient coverage yields null NDVI. Dates, valid coverage and observation counts are retained. NDVI change can also reflect harvest, crop stage or water stress and does not establish pest occurrence.

The frontend rejects malformed agronomy values and snapshots from a different base version. The map popover, rainfall page, farmer page and JSON exports show the added evidence. Regional planning screens every location and only schedules qualifying conditional support proposals; it does not generate assistance merely because observations exist.

### Support proposal limits

API-only rules explain available soil and climate evidence and identify whether a support proposal can be reviewed. Soil coverage supports fertility assessment and nutrient planning proposals, not a specific fertilizer type or dose. Climate and vegetation coverage support surveillance and extension proposals, not an insecticide allocation or diagnosis. Crop profiles remain conditional; this integration does not establish full agronomic suitability. No field input form is required. Validated Gemini analyses now replace proposal narratives when matching source inputs are available; English statistical/rule-based fallbacks remain explicitly identified.

Live Earth Engine extraction has been tested. The first weather attempt was rejected because the source provided 692 of 720 hourly images; extraction now preserves missing timestamps and publishes temporal coverage. Unit and browser tests exercise missing data, invalid values, snapshot compatibility, localization, support panels and exports; controlled data in tests are not published as observations.

## UI review updates (16 October 2026)

The planning panels omit the source/date lines below agronomy values, the methodology accordion, repeated seasonal notices, the map popover survey eyebrow, the planning slogan, calendar captions, the filter survey label, the historical Evidence column, and the regional raster footnote. Source metadata and projection parameters remain in source snapshots and exports. Support proposals show Gemini provenance when a validated analysis is available; redundant guidance badges remain removed.

The history tab now reads all 420 observed monthly records from each CHIRPS pixel in the projection snapshot and merges the latest observed rainfall, with the latest observation taking precedence if a month occurs twice. A year selector covers 1991–2026. The absent January–August 2025 observations remain null in the selected year's calendar and table. No future projections are mixed into historical observations.

The map currently uses MapLibre with OpenStreetMap. Google Maps satellite/hybrid imagery is possible through the official Maps JavaScript API, but requires a separate restricted Maps browser API key and billing. The Earth Engine service account does not enable Google Maps rendering. No Google Maps service, key, or billing has been enabled.

## Government Planning menu

The sidebar now includes Planning and omits the previous uppercase PLANNING section label. Both the sidebar entry and the map popover's Plan all locations button open the same planning board.

The board groups preparation actions into twelve months starting with the reference month in Asia/Makassar. District, support category, year, month and evidence-status controls apply to the displayed cards and counts. The sidebar retains Map, Planning and Rain calendar. Crop illustrations remain on the farmer page without the repeated Missing data blocks; source details remain accessible through the help control and evidence links.

`planning-v3` replaces the previous automatic three-proposals-per-location rule. It separates conditional preparation proposals from confirmed assistance. Current API snapshots contain no field-confirmed assistance or recipients, so the confirmed view is empty. AI prose cannot create a qualifying signal, invent a risk date or change eligibility.

- Vegetation review requires an absolute NDVI decline of at least 0.15 and a relative decline of at least 30%, with previous NDVI at least 0.3. Both non-overlapping, comparable windows require at least 80% valid coverage; the extraction minimum is three observations and mean observation count must be at least three. The current window must end no more than thirty days before the reference date; the previous window must end within ninety days. Qualifying changes request current-month field verification, without assigning a future pest outbreak.
- Water preparation uses two consecutive point projections below 100 mm/month from a projection issued within sixty days. Each continuous run creates one proposal per location, scheduled three months before its start and clamped to the current month. Low confidence and wide intervals remain visible instead of suppressing preparation. Recipients and actual deficits require field verification.
- Soil support screens modeled shallot pH outside 5.6–6.5 and organic carbon below 20 g/kg (2%). Acidic soil leads to conditional liming support; low carbon leads to conditional mature compost or organic fertilizer support. Current soil tests, including N, P and K and soil class, determine fertilizer products and rates. No NPK deficiency or dose is invented from regional proxies.
- Warm/humid weather or the mere existence of soil coverage never creates proposals. Seasonal rainfall is a preparation indicator, not a confirmed drought diagnosis.

These cutoffs are explicit pilot screening policies, not validated agronomic damage thresholds or official warnings. NDVI decline may also reflect harvest or crop stage. No qualifying signal does not establish the absence of risk. See [planning methodology](../../docs/planning-v3.md) for evidence limits. Exact measurements and screening basis appear under Why this check. AI assistance has a sparkle icon; model provenance remains inside the evidence detail.
