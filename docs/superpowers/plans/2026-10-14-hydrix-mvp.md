# HYDRIX MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user chooses that method. Implement task-by-task and track the checkboxes.

**Goal:** Membangun demo HYDRIX untuk Majalengka dengan kalender risiko musiman 12 bulan, tiga profil monokotil, draft bantuan, dan UI beUI.

**Architecture:** Pipeline Python menghasilkan snapshot geospasial dan indikator berversi. FastAPI membaca snapshot dan menghitung skenario serta kandidat secara deterministik; Gemini menjelaskan hasil melalui tools read-only. Frontend React disajikan dari layanan Cloud Run yang sama.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, sumber beUI via MCP, MapLibre GL JS, FastAPI, Pydantic, Shapely, Earth Engine Python API, Google GenAI SDK, Cloud Storage, Cloud Run, pytest, Vitest, Playwright. Gunakan npm untuk frontend dan Python 3.11+ dengan venv untuk backend; pin versi dependency yang berhasil diuji ke lockfile.

**Spec:** [Desain HYDRIX](../specs/2026-10-14-hydrix-mvp-design.md). Baca bersama PRD asal; keputusan percakapan dan spec ini mengoreksi klaim otomatis/live dalam PRD.

## Global Constraints

- Pilot adalah Kabupaten Majalengka. Bawang merah menjadi komoditas dasar; bawang daun dan bawang putih menjadi kandidat bersyarat. Mangga tidak termasuk scope.
- Kalender mencakup 12 bulan mulai bulan setelah `analysis_date`.
- Kalender merupakan skenario musiman berdasarkan histori, bukan prakiraan cuaca atau pengukuran tanah setiap kebun.
- Nilai hilang tetap null. Jangan mengarang angka, evidence, nama BPP, atau penerima bantuan.
- Record 2019 digunakan sebagai batas/atribut survei historis, bukan kondisi tanaman sekarang.
- IGT Hortikultura yang meminta token bukan dependensi P0.
- UI memakai sumber beUI dan mempertahankan helper/dependency; tidak ada package runtime `beui`.
- Admin menjalankan pipeline melalui CLI dengan kredensial terpisah.
- Maksimal delapan panggilan tool, tiga putaran model, 30 detik total, dan satu percobaan perbaikan schema per analisis.
- Rate limit analisis default 10 request per menit per IP, batas payload 16 KiB, dan maksimum 100 poligon per permintaan pemerintah.

## Review Focus

1. Kebun terduplikasi lintas-layer atau label wilayah salah: deduplikasi konservatif dan cek geometri kabupaten (Task 2).
2. Bulan hilang, awan, dan tanggal sumber berbeda: status unknown dan timestamp per dataset (Task 3).
3. Tidak ada kandidat layak atau hanya satu: tetap hasil valid, tidak memaksa tiga rekomendasi (Task 4).
4. Tool/model mengembalikan ID palsu, instruksi dari sumber, atau gagal: validasi dan fallback deterministik (Task 6).
5. GPS ditolak, tidak cocok, dan respons lokasi lama tiba terlambat: pemilihan eksplisit dan hasil sesuai lokasi terbaru (Task 7).

## Struktur file dan kontrak

```text
apps/web/                         React UI, beUI source, dan tes browser
apps/api/hydrix/                  schemas.py, repository.py, main.py
apps/api/hydrix/data/             normalize.py, geospatial.py, quality.py
apps/api/hydrix/analysis/         seasonal.py, crops.py, interventions.py
apps/api/hydrix/ai/               tools.py, orchestrator.py, validation.py
apps/api/hydrix/reports/          render.py, templates/report.html
apps/api/tests/                  fixture sintetis berlabel dan tes perilaku
pipelines/                       kementan.py, earth_engine.py, build_snapshot.py
config/                          sources.json, crops.json, interventions.json
data/snapshots/<snapshot_id>/    manifest.json, locations.geojson, indicators.json, infrastructure.geojson
data/raw/                        tidak dilayani publik dan diabaikan Git
infra/                           Dockerfile, cloudrun.md
```

Task 1 mendefinisikan seluruh model bersama dalam `schemas.py`; TypeScript dihasilkan dari OpenAPI, bukan ditulis ulang manual:

- `Location`: id stabil `source:layer:objectid`, geometry EPSG:4326, surveyed_crop_id nullable, survey_date nullable, district_code, quality_flags, evidence_ids.
- `Evidence`: id, source_url, dataset_id, kind (`survey|observation|reanalysis|scenario|demo`), available_through nullable, extracted_at, resolution_m nullable.
- `SnapshotManifest`: snapshot_id, created_at, method_version, sha256 per file, evidence, quality_summary.
- `MonthlyIndicator`: location_id, month YYYY-MM, rainfall_mm nullable, soil_water_layer_1/2 nullable, ndvi nullable, valid_fraction, evidence_ids.
- `SeasonalMonth`: month YYYY-MM, rainfall_p20/p50/p80 nullable, soil_water_p50 nullable, risk (`elevated|watch|typical|unknown`), evidence_ids.
- `CropProfile`: crop_id, scientific_name, family, duration_days [min,max], reviewed, source_urls, sourced_limits, required_factors.
- `CropCandidate`: crop_id, status (`conditional|excluded|insufficient_data`), reasons, unknown_factors, suggested_start_month nullable, evidence_ids.
- `AnalysisRequest`: location_ids (1–100), analysis_date ISO date, audience (`gov|farmer`). Farmer menerima tepat satu lokasi.
- `AnalysisResult`: analysis_id, snapshot_id, method_version, calendars keyed by location_id, candidates keyed by location_id, interventions, evidence_ids, limitations, ai_status (`available|unavailable`), narrative nullable, draft=true.

## Task 1: Kontrak dan aplikasi yang berjalan lokal

**Files:** `apps/api/hydrix/{schemas.py,main.py,repository.py}`, `apps/api/pyproject.toml`, `apps/web/{package.json,src/main.tsx,src/app.tsx}`, `apps/api/tests/test_contracts.py`, `.gitignore`, `.env.example`.

**Interfaces:** `SnapshotRepository.load(snapshot_id: str) -> SnapshotManifest`; `GET /api/health -> {status,snapshot_ready}`; frontend menerima endpoint `/api` dari origin sama.

- [ ] Definisikan tes: field tak dikenal ditolak, koordinat invalid ditolak, 101 lokasi ditolak, farmer dua lokasi ditolak, nilai indikator null diterima, dan draft tidak boleh false.
- [ ] Buat skeleton proyek, venv, dependency terpin, kontrak Pydantic, health route, halaman kosong, dan Vite proxy lokal. Tidak memasukkan credential nyata atau data raw ke Git.
- [ ] Jalankan `python -m pytest apps/api/tests/test_contracts.py -q` dan `npm --prefix apps/web run build`; expected semua tes PASS dan build sukses.
- [ ] Commit perubahan Task 1 jika repo Git telah diinisialisasi pada tahap eksekusi.

## Task 2: Snapshot Kementan yang lolos QC

**Files:** `pipelines/kementan.py`, `pipelines/build_snapshot.py`, `config/sources.json`, `apps/api/hydrix/data/{normalize.py,geospatial.py,quality.py}`, `apps/api/tests/test_kementan.py`.

**Interfaces:** `fetch_features(service_url: str, allowed_fields: list[str], geometry_filter: dict | None) -> dict`; `normalize_locations(features: dict, district_geometry: dict) -> tuple[list[Location], dict]`; `build_snapshot(output_dir: Path) -> SnapshotManifest`.

- [ ] Tulis fixture/tes pagination, transfer limit, geometri salah, label wilayah palsu, record `uji`, null, sumber duplikat, dan field pribadi. Assert field pribadi tidak masuk hasil; record uji dikarantina; dua poligon bertumpuk tidak digabung tanpa bukti identitas/survei.
- [ ] Audit layer batas kabupaten Hosted, identifikasi Majalengka dari kode/nama serta geometri, dan simpan sumbernya. Jika batas resmi tidak dapat diambil, task tetap belum selesai; fixture demo tidak menggantikan batas nyata.
- [ ] Implementasikan pagination berbasis object IDs atau offset sesuai capability, timeout 20 detik/request, maksimal dua retry transient, filter server di wilayah pilot, `outSR=4326`, whitelist atribut, dan manifest/checksum.
- [ ] Ambil Hortikultura, BawangMerah, BawangPutih, BPP, serta daerah irigasi yang berpotongan dengan pilot. BawangPutih `uji` masuk quarantine; bukan proof kondisi tanah. Kandidat BPP membawa ID dan jarak, tidak nama palsu.
- [ ] Jalankan `python -m pytest apps/api/tests/test_kementan.py -q`; expected PASS. Jalankan `python -m pipelines.build_snapshot --output data/snapshots/local`; expected manifest dan minimal satu poligon asli lolos QC. Laporkan jumlah sebelum/sesudah QC, bukan mengunci 109 sebagai hasil final.
- [ ] Commit pipeline/config/tes; raw data tidak di-commit.

## Task 3: Ekstraksi indikator dan baseline historis

**Files:** `pipelines/earth_engine.py`, `apps/api/hydrix/analysis/seasonal.py`, `apps/api/tests/test_seasonal.py`, `data/snapshots/<id>/indicators.json`.

**Interfaces:** `extract_monthly_indicators(locations: list[Location], end_month: str) -> list[MonthlyIndicator]`; `build_calendar(history: list[MonthlyIndicator], analysis_date: date) -> list[SeasonalMonth]`.

- [ ] Tulis tes baseline tidak memakai tahun setelah 2020, jumlah hujan merupakan sum bukan mean, missing tidak menjadi nol, bulan lintas Desember, tepat 12 bulan, minimal 24 tahun baseline, dan bulan NDVI invalid tidak diberi angka.
- [ ] Verifikasi project Earth Engine, akses dataset, metadata resolusi, dan band. Ekstrak CHIRPS/ERA5 baseline 1991–2020, NDVI 2019–2025 dan bulan lengkap terbaru, serta elevasi SRTM. Catat ketersediaan per dataset; tidak menjalankan ekstraksi ketika pengguna membuka halaman.
- [ ] Implementasikan komposit NDVI dengan cloud/shadow mask dan syarat tiga observasi/50% piksel. Agregasi poligon kecil harus tetap mencatat dukungan spasial coarse; sampling regional tidak diklaim presisi kebun.
- [ ] Implementasikan risk `seasonal-v1` persis sesuai spec. Vegetasi hanya konteks historis; tidak ada prediksi NDVI tanaman masa depan.
- [ ] Jalankan `python -m pytest apps/api/tests/test_seasonal.py -q`; expected PASS. Jalankan CLI ekstraksi pada satu poligon terlebih dulu, lalu pilot yang lolos QC; expected timestamp, band, unit, dan null terdokumentasi.
- [ ] Lakukan hindcast terhadap tahun yang tidak digunakan baseline, laporkan MAE hujan baseline serta cakupan rentang historis. Tidak menyebut hasil ini validasi prediksi 12 bulan mendatang. Commit kode/tes dan ringkasan evaluasi.

## Task 4: Kandidat tanaman dan aturan draft bantuan

**Files:** `config/{crops.json,interventions.json}`, `apps/api/hydrix/analysis/{crops.py,interventions.py}`, `apps/api/tests/test_candidates.py`.

**Interfaces:** `evaluate_candidates(location: Location, calendar: list[SeasonalMonth], profiles: list[CropProfile], context: dict) -> list[CropCandidate]`; `propose_interventions(location: Location, calendar: list[SeasonalMonth], infrastructure: dict) -> list[dict]`.

- [ ] Susun tiga profil dari sumber Kementan yang dapat ditelusuri: bawang merah, bawang daun, bawang putih. Pisahkan metode/varietas jika durasi berbeda. Batas yang belum didukung sumber tetap null dan profile belum reviewed; bukan angka buatan.
- [ ] Tulis tes hanya satu kandidat conditional, semua insufficient_data, constraint elevasi menggugurkan kandidat, window tanam melewati musim berbeda, profile belum reviewed, serta riwayat Allium menghasilkan catatan risiko OPT.
- [ ] Implementasikan penyaringan hard constraints bersumber, pemeriksaan seluruh window tanam, kemudian urutan kandidat berdasarkan jumlah kondisi terdukung. Tie-break menggunakan crop_id stabil. Tidak ada persentase peluang panen atau kesimpulan tanah sesuai ketika pH/tekstur tidak tersedia.
- [ ] Buat katalog intervensi P0: konservasi air, pemeriksaan sarana air, pendampingan budidaya. Jika sarana operasional tidak diketahui, usulkan pemeriksaan kelayakan, bukan menyatakan pompa/irigasi pasti bekerja. Bulan persiapan satu bulan sebelum awal risiko elevated; jika tidak ada elevated, tidak membuat jadwal distribusi wajib.
- [ ] Jalankan `python -m pytest apps/api/tests/test_candidates.py -q`; expected PASS. Commit profil, sumber, aturan, dan tes.

## Task 5: UI pemerintah dengan beUI dan API deterministik

**Files:** `apps/api/hydrix/main.py`, `apps/api/tests/test_api.py`, `apps/web/src/{api/client.ts,api/types.ts,features/gov/dashboard.tsx,features/map/pilot-map.tsx,features/analysis/calendar-table.tsx,features/analysis/candidate-cards.tsx,features/data/source-panel.tsx}`, `apps/web/components/motion/`, `apps/web/lib/`, `apps/web/tests/gov.spec.ts`.

**Interfaces:** `GET /api/locations`, `GET /api/locations/{id}`, `POST /api/analysis -> AnalysisResult`. ID tidak dikenal menghasilkan 404; snapshot belum siap 503; request salah 422; rate limit 429. Semua handler membaca snapshot yang sama selama satu request.

- [ ] Hasilkan TypeScript dari OpenAPI dan konfigurasi alias `@/` ke root `apps/web`. Domain code tinggal di src; path beUI asli tetap `components/motion`, `components/agents`, dan `lib`.
- [ ] Gunakan MCP get_component untuk animated-sidebar, card, tabs, button, combobox, select, table, drawer, bottom-sheet, agent-activity, citations, animated-toast-stack, loader. Salin file lengkap/dependency, pertahankan helper bersama, dan baca source sebelum import. Contoh exports terverifikasi: AnimatedSidebarProvider/AnimatedSidebar, Card/CardContent, Tabs/TabsTrigger, Button/StatefulButton, Table, AgentActivity, Citations. Jangan menganggap nama export komponen lain tanpa membaca source.
- [ ] Tulis tes API untuk ID palsu dan snapshot absent. Tulis browser test memilih poligon, mengganti bulan, menampilkan tepat 12 baris kalender, tanggal survei historis, unknown, dan kandidat terbatas.
- [ ] Implementasikan dashboard dengan MapLibre, layer poligon/irigasi/BPP, panel detail dan source. Basemap memakai sumber yang lisensinya dipenuhi; peta tetap dapat menampilkan GeoJSON di background polos saat tile gagal. Pemilih poligon/tabel menjadi alternatif keyboard terhadap klik peta.
- [ ] Gunakan Table untuk kalender/perbandingan; Card untuk kandidat; drawer untuk detail desktop. Hindari widget finansial untuk nilai iklim. Tidak merender seluruh histori raster di browser.
- [ ] Jalankan `python -m pytest apps/api/tests/test_api.py -q`, `npm --prefix apps/web run build`, dan `npm --prefix apps/web run test:e2e -- gov.spec.ts`; expected PASS/build sukses. Commit.

## Task 6: Gemini tool calling dan evidence tervalidasi

**Files:** `apps/api/hydrix/ai/{tools.py,orchestrator.py,validation.py}`, `apps/api/tests/test_ai.py`, `apps/web/src/features/analysis/ai-panel.tsx`.

**Interfaces:** `run_analysis(request: AnalysisRequest, base: AnalysisResult) -> AnalysisResult`; enam tools dalam spec menerima location_id/snapshot_id terdaftar dan mengembalikan objek JSON. `POST /api/analysis` sinkron dengan batas total AI 30 detik. Respons menambahkan `tool_events: list[{tool_name,status,started_at,finished_at}]`. Selama request berlangsung UI memakai Loader; setelah selesai AgentActivity menampilkan trace tool aktual. SSE/polling tidak termasuk P0.

- [ ] Tulis tes unknown tool/ID, lebih delapan panggilan, prompt injection dalam teks sumber, evidence palsu, angka narasi tidak cocok, timeout, API key absent, satu repair gagal, serta tidak ada kandidat. Assert base result tetap tersedia dan ai_status unavailable saat gagal.
- [ ] Implementasikan allowlist tools read-only; semua input divalidasi. Jalankan model dengan environment `GEMINI_MODEL`, bounded loop, schema response, dan validator semantic. Pengulangan repair ikut batas total 30 detik/putaran.
- [ ] Cocokkan angka melalui field structured result; narasi bebas tidak menjadi sumber angka UI. Jika model menambah angka tanpa evidence atau kandidat di luar base result, tolak hasil AI. Sources/text tidak diberi hak mengubah instruksi sistem.
- [ ] Hubungkan AgentActivity ke tool_events respons aktual, bukan chain-of-thought. Gunakan Citations untuk evidence terdaftar dan label AI unavailable saat fallback. Key tidak masuk frontend. Tambahkan field tool_events ke schemas.py dan regenerasi TypeScript OpenAPI dalam task ini.
- [ ] Jalankan `python -m pytest apps/api/tests/test_ai.py -q`; expected PASS dengan mock SDK. Lakukan satu smoke test live hanya setelah kredensial tersedia; catat model dan latency tanpa mencetak key. Commit.

## Task 7: Tampilan petani dan fallback lokasi

**Files:** `apps/web/src/features/farmer/{farmer-page.tsx,location-picker.tsx,use-location.ts}`, `apps/api/hydrix/data/geospatial.py`, `apps/web/tests/farmer.spec.ts`, `apps/api/tests/test_location.py`.

**Interfaces:** `POST /api/resolve-location {latitude,longitude,accuracy_m} -> {status: matched|outside_pilot|no_polygon|low_accuracy, location_id: str|null}`. Akurasi >100 m memerlukan pemilihan eksplisit, bukan pencocokan otomatis. Titik tepat pada batas menggunakan covers; overlap menghasilkan daftar pilihan, tidak memilih pemilik.

- [ ] Tulis tes GPS denied/timeout, outside pilot, titik tanpa poligon, akurasi >100 m, overlap, boundary point, serta respons lokasi lama setelah pilihan berubah. Assert tidak ada peralihan demo diam-diam.
- [ ] Implementasikan lokasi opt-in, request timeout 10 detik, pembatalan/sequence guard, dan koordinat hanya selama sesi. Fallback menampilkan tombol demo atau pemilih poligon; label demo tetap terlihat pada hasil dan laporan.
- [ ] Susun kartu kondisi regional, kandidat bersyarat, faktor belum diketahui, dan kalender melalui beUI Card/Table/BottomSheet. GPS bukan identitas kebun; teks menjelaskan “lokasi terdeteksi” dan pilihan kebun.
- [ ] Jalankan `python -m pytest apps/api/tests/test_location.py -q` dan `npm --prefix apps/web run test:e2e -- farmer.spec.ts`; expected PASS pada viewport 390 px dan desktop. Periksa keyboard/focus dan reduced motion. Commit.

## Task 8: Ekspor dan deployment demo

**Files:** `apps/api/hydrix/reports/{render.py,templates/report.html}`, `apps/api/tests/test_reports.py`, `apps/web/tests/report.spec.ts`, `infra/{Dockerfile,cloudrun.md}`, `README.md`.

**Interfaces:** `GET /api/reports/{analysis_id}.html`, `GET /api/reports/{analysis_id}.json`; analysis_id ephemeral memiliki TTL 24 jam di cache proses. Setelah restart/instance berbeda, 404 menyuruh menjalankan ulang; deployment demo menggunakan max-instances=1. P1 memindahkan hasil ke Cloud Storage jika perlu persistensi/multi-instance.

- [ ] Tulis tes export memuat snapshot/metode/evidence, HTML escaping sumber tidak terpercaya, label demo, draft, AI unavailable, dan ID kedaluwarsa.
- [ ] Implementasikan HTML print stylesheet dan JSON. Tombol cetak memakai browser; tidak menjanjikan PDF server. Kolom reviewer kosong; tidak menambahkan identitas pejabat.
- [ ] Bangun Docker multi-stage: frontend build, Python runtime, static frontend, endpoint API, SPA fallback tanpa menelan route /api. Gunakan PORT dari Cloud Run. Tarik snapshot immutable dari bucket saat startup, verifikasi checksum, gagal tertutup jika invalid.
- [ ] Dokumentasikan GCP project, Earth Engine enablement, bucket private, service account minimum read snapshot, Secret Manager, model env, region, max-instances=1, concurrency=8, memory awal 1 GiB, dan timeout request 60 detik. Batasi ukuran cache 100 hasil dan TTL 24 jam; aplikasi frontend tetap dapat menampilkan hasil yang sudah diterima.
- [ ] Jalankan seluruh pytest, frontend build, dan Playwright; expected PASS. Lakukan smoke test container lokal sebelum deployment. Deployment dilakukan saat tahap implementasi dengan project tujuan yang diketahui, bukan membuat project eksternal saat penulisan plan.
- [ ] Validasi URL HTTPS, lokasi ditolak, model timeout, tile gagal, dan report print pada layanan deployed. Catat batas operasional demo serta commit.

## Urutan dan pembagian kerja tim dua orang

- 14 Oktober: Task 1–2, audit profil Task 4, verifikasi akses GEE/Gemini. UI dapat membaca fixture berlabel setelah kontrak Task 1 stabil.
- 15 Oktober: Task 3–4; orang data menangani pipeline/profil, orang full-stack menyelesaikan API/UI Task 5.
- 16 Oktober: Task 5–7, integrasi data nyata dan Gemini.
- 17 Oktober: Task 8, pengujian end-to-end dan latihan demo.
- 18 Oktober: buffer perbaikan dan pengumpulan jika tenggat PRD terkonfirmasi. Tanggal kompetisi belum diverifikasi; jadwal ini estimasi, bukan jaminan.

Pembagian manusia ini bukan instruksi untuk otomatis men-spawn subagent. Eksekusi native direkomendasikan karena kontrak antar-task rapat dan proyek dimulai kosong.

## Checkpoint dan pengurangan scope

Setelah Task 2: lanjut hanya jika minimal satu poligon nyata lolos QC dan batas pilot terverifikasi. Setelah Task 3: indikator nyata tersedia dan tanggal sumber benar. Jika akses GEE belum tersedia, UI berjalan dengan fixture demo, tetapi milestone data nyata tetap belum selesai.

Jika waktu habis, potong chat bebas, scheduler otomatis, grafik tambahan, SSE, PDF server, dan autentikasi role. Jangan memotong validasi evidence, timestamp sumber, null handling, label demo, atau batas klaim skenario. NDVI/elevasi yang gagal dapat tetap unknown; rekomendasi terkait tidak dipaksakan. Gemini gagal boleh fallback deterministik, tetapi keberhasilan integrasi AI masih harus dilaporkan belum tercapai.

## Handoff

Plan siap ditinjau; belum ada kode produk, dependency terpasang, atau resource cloud dibuat. Pilihan eksekusi: native dalam sesi ini, atau subagent-driven setelah user memilih. Workspace belum merupakan repo Git; dokumen belum di-commit. Saat eksekusi, inisialisasi repo lokal hanya jika belum ada, lalu gunakan commit per task.
