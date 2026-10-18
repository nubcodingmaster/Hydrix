# HYDRIX

HYDRIX membantu petani dan pemerintah membaca kondisi lahan, pola hujan, serta kandidat tanam hortikultura musiman. Pilot awal berada di Majalengka, Jawa Barat, dengan fokus bawang merah, bawang daun, dan bawang putih. Ketiganya merupakan kandidat yang perlu dinilai kesesuaiannya; aplikasi belum menetapkan semuanya layak ditanam pada setiap lokasi.

## Brief proyek

Petani mendapat halaman publik yang ramah ponsel, tanpa login, untuk membaca ringkasan lokasi, proyeksi hujan, dan kandidat tanam. Pemerintah mendapat peta dengan poligon lahan. Klik lokasi membuka popover berisi konteks lingkungan, kalender hujan, kandidat komoditas, serta rekomendasi tindakan verifikasi. Perencanaan seluruh lokasi dapat dibuka dari popover untuk meninjau kebutuhan wilayah.

Tujuan proyek adalah membantu perencanaan berbasis bukti. Rekomendasi saat ini mendukung peninjauan oleh penyuluh, bukan menetapkan penerima bantuan atau menjamin hasil panen.

## Demo dan dokumentasi

[Buka demo HYDRIX](https://hydrix-724949319680.asia-southeast2.run.app/) — runtime Cloud Run Jakarta (`asia-southeast2`), akses publik tanpa login.

- [Setup aplikasi dan metode data](apps/web/README.md)
- [Analisis Gemini otomatis dan pengaturan secret](docs/ai-automation.md)
- [Indikator perencanaan bantuan](docs/planning-v3.md)
- [Deployment Jakarta](docs/cloud-run.md)
- [Hasil verifikasi AI](docs/gemini-verification.md)
- [Batas keamanan](docs/security.md)
