# Interview Workspace

**Aplikasi web Local-First untuk mengelola proses wawancara dan analisis
data kualitatif dalam satu ruang kerja.**

Interview Workspace membantu mahasiswa, peneliti, dosen, dan tim riset
mengelola alur penelitian wawancara---mulai dari menyiapkan panduan
pertanyaan, mengatur narasumber dan sesi, mencatat jawaban, hingga
melakukan coding, menyusun kategori dan tema, membandingkan temuan,
serta mengekspor data.

Aplikasi dirancang dengan pendekatan **Local-First**: data operasional
disimpan di perangkat pengguna melalui IndexedDB. Pencadangan ke Google
Drive bersifat opsional dan dikendalikan oleh pengguna.

> **Catatan:** README ini menjelaskan tujuan produk, rancangan fitur,
> dan alur penggunaan berdasarkan PRD revisi Local-First serta dokumen
> System Flow. Ketersediaan setiap fitur mengikuti tahap implementasi
> pada kode aplikasi.

------------------------------------------------------------------------

## Daftar Isi

-   [Fitur Utama](#fitur-utama)
-   [Komponen dan Modul Aplikasi](#komponen-dan-modul-aplikasi)
-   [Teknologi](#teknologi)
-   [Prinsip Penyimpanan dan Privasi](#prinsip-penyimpanan-dan-privasi)
-   [Cara Menjalankan Project](#cara-menjalankan-project)
-   [Cara Menggunakan Aplikasi](#cara-menggunakan-aplikasi)
-   [Alur Kerja Singkat](#alur-kerja-singkat)
-   [Struktur Navigasi](#struktur-navigasi)
-   [Status Penyimpanan dan Backup](#status-penyimpanan-dan-backup)
-   [Ekspor dan Pemulihan Data](#ekspor-dan-pemulihan-data)
-   [Rancangan Antarmuka](#rancangan-antarmuka)
-   [Batasan MVP](#batasan-mvp)
-   [Dokumentasi Proyek](#dokumentasi-proyek)

## Fitur Utama

-   **Manajemen proyek penelitian** --- membuat, mengedit, mencari,
    mengarsipkan, dan menghapus proyek.
-   **Impor dokumen sumber** --- memasukkan dokumen DOCX, PDF, atau TXT,
    menempelkan teks, maupun menulis pertanyaan secara manual.
-   **Penyusunan panduan wawancara** --- mengelompokkan, mengurutkan,
    mengedit, menduplikasi, dan mengelola pertanyaan.
-   **Manajemen narasumber** --- menggunakan kode anonim seperti `R01`,
    `R02`, dan seterusnya.
-   **Manajemen sesi wawancara** --- membuat beberapa sesi untuk
    narasumber dan menyimpan metadata setiap sesi.
-   **Pencatatan jawaban dan autosave** --- mencatat jawaban narasumber
    serta catatan pewawancara secara terpisah.
-   **Pusat data jawaban** --- meninjau data berdasarkan narasumber
    maupun pertanyaan.
-   **Analisis kualitatif** --- coding manual, kategori, tema, memo, dan
    bukti kutipan.
-   **Perbandingan jawaban** --- melihat persamaan dan perbedaan jawaban
    antarnarasumber.
-   **Ekspor data** --- keluaran yang direncanakan mencakup DOCX, PDF,
    XLSX/CSV, dan JSON.
-   **Backup dan restore JSON** --- membuat salinan proyek dan
    memulihkannya kembali.
-   **Backup Google Drive opsional** --- mencadangkan proyek tertentu ke
    Drive milik pengguna.

## Komponen dan Modul Aplikasi

  -----------------------------------------------------------------------
  Modul                               Fungsi
  ----------------------------------- -----------------------------------
  Dashboard                           Ringkasan proyek, aktivitas
                                      terbaru, pencarian, filter, dan
                                      status penyimpanan

  Manajemen Proyek                    Membuat dan mengelola informasi
                                      serta status proyek penelitian

  Dokumen Sumber                      Menyimpan dokumen asli yang menjadi
                                      sumber panduan wawancara

  Panduan Pertanyaan                  Mengelola bagian, daftar
                                      pertanyaan, urutan, dan petunjuk
                                      pewawancara

  Narasumber                          Menyimpan kode, informasi opsional,
                                      dan riwayat wawancara

  Sesi Wawancara                      Mengelola waktu, metode,
                                      pewawancara, status, dan catatan
                                      sesi

  Editor Jawaban                      Mencatat jawaban dan catatan
                                      pewawancara dengan autosave

  Pusat Data Jawaban                  Menelusuri dan membandingkan
                                      jawaban berdasarkan narasumber atau
                                      pertanyaan

  Analisis Data                       Mengelola coding, kategori, tema,
                                      memo, dan kutipan pendukung

  Ekspor                              Menghasilkan dokumen, tabel,
                                      laporan, dan file backup

  Backup & Restore                    Mengunduh atau memulihkan data
                                      proyek melalui JSON

  Integrasi Google Drive              Mengelola koneksi dan backup cloud
                                      per proyek
  -----------------------------------------------------------------------

### Komponen antarmuka

Antarmuka dirancang menggunakan komponen produktivitas yang konsisten,
antara lain:

-   Sidebar navigasi, header, dan breadcrumb.
-   Search bar dan filter.
-   Kartu proyek dan status badge.
-   Indikator progres dan status autosave.
-   Dialog konfirmasi dan notifikasi.
-   Area unggah dokumen (*upload dropzone*).
-   Daftar/kartu pertanyaan dan editor jawaban.
-   Kotak catatan pewawancara.
-   Chip kode, kategori, dan tema.
-   Tampilan kosong, loading, skeleton, dan error state.

## Teknologi

  -----------------------------------------------------------------------
  Area                    Teknologi rancangan     Peran
  ----------------------- ----------------------- -----------------------
  Frontend                React + TypeScript      Antarmuka dan logika
                                                  aplikasi

  Build tool              Vite                    Pengembangan dan build
                                                  aplikasi

  Styling                 Tailwind CSS            Styling dan design
                                                  token

  UI components           shadcn/ui atau komponen Komponen antarmuka
                          custom                  

  Database lokal          IndexedDB               Penyimpanan utama data
                                                  proyek

  IndexedDB wrapper       Dexie                   Query, transaksi, dan
                                                  versioning database

  Routing                 HashRouter atau         Navigasi halaman
                          konfigurasi SPA yang    
                          sesuai                  

  Autentikasi Google      Google Identity         Otorisasi koneksi
                          Services                Google

  Backup cloud            Google Drive API v3     Menyimpan file JSON
                                                  proyek

  Hosting                 GitHub Pages / static   Publikasi aplikasi web
                          hosting                 
  -----------------------------------------------------------------------

Teknologi di atas merupakan rekomendasi arsitektur pada dokumen PRD.
Detail implementasi aktual dapat mengikuti dependensi yang tersedia di
repository.

## Prinsip Penyimpanan dan Privasi

Interview Workspace menerapkan prinsip berikut:

1.  **IndexedDB adalah penyimpanan utama.** Data operasional proyek
    disimpan di browser/perangkat pengguna.
2.  **Tidak membutuhkan akun aplikasi.** Pengguna dapat membuka aplikasi
    tanpa registrasi atau login ke server aplikasi.
3.  **Dapat digunakan secara offline.** Fitur inti untuk data lokal
    tidak bergantung pada koneksi Google Drive.
4.  **Google Drive bersifat opsional.** Backup hanya dilakukan untuk
    proyek yang dipilih dan diaktifkan pengguna.
5.  **Simpan lokal terlebih dahulu.** Perubahan harus berhasil disimpan
    di IndexedDB sebelum dimasukkan ke antrean sinkronisasi.
6.  **Status lokal dan cloud dipisahkan.** "Tersimpan di perangkat"
    tidak sama dengan "Tersinkron ke Google Drive".
7.  **Tidak ada backend/database pusat pada rancangan MVP.** Aplikasi
    tidak menggunakan PostgreSQL, Firebase, atau Supabase sebagai
    penyimpanan utama.
8.  **Pengguna mengendalikan data.** Koneksi Google, backup, pemulihan,
    penyelesaian konflik, dan penghapusan salinan cloud memerlukan
    tindakan pengguna.

> Penyimpanan lokal bukan pengganti backup. Jika browser atau perangkat
> hilang, data lokal dapat ikut hilang. Buat backup JSON atau aktifkan
> backup Google Drive untuk proyek penting.

## Cara Menjalankan Project

### Persyaratan

-   Node.js versi LTS yang kompatibel dengan dependensi project.
-   npm (atau package manager yang digunakan repository).
-   Git.
-   Zed, Visual Studio Code, atau editor kode lainnya.

### 1. Clone repository

``` bash
git clone https://github.com/naandarz/interview_app.git
cd interview_app
```

Jika URL repository berbeda, gunakan URL repository milikmu.

### 2. Instal dependensi

``` bash
npm install
```

### 3. Jalankan server pengembangan

``` bash
npm run dev
```

Buka alamat lokal yang ditampilkan oleh Vite di terminal (umumnya
`http://localhost:5173`).

### 4. Build untuk produksi

``` bash
npm run build
```

### 5. Preview hasil build

``` bash
npm run preview
```

> Perintah di atas mengikuti workflow umum project React + Vite.
> Pastikan script `dev`, `build`, dan `preview` tersedia pada bagian
> `scripts` di `package.json`. Jika nama script berbeda, gunakan script
> yang tercantum di repository.

## Cara Menggunakan Aplikasi

### 1. Buka Dashboard

Dashboard menjadi halaman awal untuk melihat daftar proyek, aktivitas
terbaru, ringkasan jumlah proyek/narasumber/sesi, serta status
penyimpanan dan backup.

### 2. Buat proyek baru

1.  Pilih **Buat Proyek**.
2.  Isi nama proyek, deskripsi, tujuan wawancara, dan catatan umum.
3.  Pada bagian **Penyimpanan dan Pencadangan**, penyimpanan di
    perangkat selalu aktif.
4.  Aktifkan **Cadangkan proyek ini ke Google Drive** hanya jika ingin
    menggunakan backup cloud.
5.  Simpan proyek.

Secara default, backup Google Drive dalam keadaan **OFF**. Proyek tetap
dibuat dan disimpan lokal meskipun Google Drive belum terhubung atau
internet tidak tersedia.

### 3. Siapkan dokumen dan pertanyaan

1.  Buka menu **Dokumen Sumber** atau **Panduan Pertanyaan**.
2.  Unggah dokumen DOCX/PDF/TXT, tempel teks, atau masukkan pertanyaan
    secara manual.
3.  Periksa pratinjau hasil ekstraksi.
4.  Edit judul, bagian, dan pertanyaan jika diperlukan.
5.  Simpan panduan pertanyaan.

Dokumen sumber asli tetap dipisahkan dari hasil ekstraksi dan pertanyaan
yang sudah diedit.

### 4. Tambahkan narasumber

1.  Buka menu **Narasumber**.
2.  Tambahkan kode narasumber, misalnya `R01`.
3.  Isi nama atau informasi tambahan jika diperlukan.
4.  Simpan narasumber.

Kode narasumber harus unik dalam satu proyek. Nama asli bersifat
opsional.

### 5. Buat sesi wawancara

1.  Buka menu **Sesi Wawancara**.
2.  Pilih narasumber.
3.  Isi metadata sesi seperti tanggal, metode wawancara, pewawancara,
    durasi, dan catatan.
4.  Sistem menggunakan pertanyaan aktif dari panduan proyek sebagai
    referensi/snapshot sesi.
5.  Simpan dan buka workspace sesi.

Perubahan panduan pertanyaan setelah sesi dibuat tidak mengubah daftar
pertanyaan sesi lama secara otomatis.

### 6. Catat jawaban

1.  Pilih pertanyaan pada panel daftar pertanyaan.
2.  Masukkan jawaban narasumber pada editor jawaban.
3.  Masukkan catatan pewawancara pada kolom terpisah.
4.  Periksa indikator autosave.
5.  Gunakan navigasi sebelumnya/selanjutnya untuk berpindah pertanyaan.

Status jawaban yang dirancang: `Belum Dijawab`, `Terisi`,
`Perlu Klarifikasi`, dan `Ditinjau`.

### 7. Tinjau pusat data jawaban

Gunakan dua perspektif:

-   **Berdasarkan narasumber:** melihat seluruh sesi dan jawaban dari
    satu narasumber.
-   **Berdasarkan pertanyaan:** membandingkan jawaban dari berbagai
    narasumber untuk pertanyaan yang sama.

Gunakan pencarian, filter, penanda penting, dan catatan analisis untuk
meninjau data.

### 8. Lakukan analisis kualitatif

1.  Pilih jawaban atau pertanyaan yang akan dianalisis.
2.  Tandai potongan teks yang relevan.
3.  Pilih kode yang sudah ada atau buat kode baru.
4.  Tambahkan catatan coding bila diperlukan.
5.  Kelompokkan kode ke dalam kategori.
6.  Susun tema dari pola kategori.
7.  Hubungkan tema dengan kutipan jawaban sebagai bukti.
8.  Gunakan memo untuk mencatat interpretasi atau pertanyaan analisis.

Interpretasi akhir tetap dikendalikan peneliti. Kode, kategori, dan tema
harus dapat ditelusuri ke jawaban sumber.

### 9. Ekspor hasil atau buat backup

Buka menu **Ekspor** untuk memilih cakupan data dan format keluaran yang
tersedia. Untuk cadangan mandiri, gunakan backup JSON. Sebelum restore,
sistem perlu memvalidasi file dan menampilkan ringkasan isi backup.

## Alur Kerja Singkat

``` text
Dashboard
   |
   v
Buat Proyek
   |
   v
Impor Dokumen / Buat Pertanyaan
   |
   v
Kelola Narasumber
   |
   v
Buat Sesi Wawancara
   |
   v
Catat Jawaban (Autosave ke IndexedDB)
   |
   v
Pusat Data Jawaban
   |
   v
Coding -> Kategori -> Tema -> Memo
   |
   v
Perbandingan dan Penyusunan Temuan
   |
   v
Ekspor / Backup JSON / Backup Google Drive
```

## Struktur Navigasi

### Navigasi utama

-   Dashboard
-   Semua Proyek
-   Pengaturan Aplikasi

### Navigasi dalam proyek

1.  Ikhtisar
2.  Dokumen Sumber
3.  Panduan Pertanyaan
4.  Narasumber
5.  Sesi Wawancara
6.  Data Jawaban
7.  Analisis Data
8.  Ekspor
9.  Pengaturan Proyek

## Status Penyimpanan dan Backup

  -----------------------------------------------------------------------
  Status                              Makna
  ----------------------------------- -----------------------------------
  Menyimpan                           Data sedang ditulis ke IndexedDB

  Tersimpan di perangkat              Penulisan lokal berhasil

  Gagal menyimpan                     Penulisan lokal gagal; input harus
                                      tetap dipertahankan

  Belum dicadangkan                   Backup belum diaktifkan atau belum
                                      pernah berhasil

  Menunggu sinkronisasi               Ada perubahan lokal yang belum
                                      dikirim ke Drive

  Menyinkronkan                       Upload/update ke Drive sedang
                                      berlangsung

  Tersinkron ke Google Drive          Snapshot terbaru berhasil diunggah
                                      atau diperbarui

  Konflik                             Versi lokal dan Drive berbeda dan
                                      membutuhkan keputusan pengguna

  Perlu menghubungkan ulang           Izin/token Google perlu diperbarui

  Gagal menyinkronkan                 Proses Drive gagal dan dapat dicoba
                                      kembali
  -----------------------------------------------------------------------

Menonaktifkan backup hanya menghentikan pengiriman perubahan berikutnya.
File backup yang sudah ada di Google Drive tidak otomatis dihapus.

## Ekspor dan Pemulihan Data

Format keluaran yang direncanakan:

-   **DOCX:** panduan pertanyaan dan dokumen hasil wawancara.
-   **PDF:** dokumen siap dibaca atau dicetak.
-   **XLSX/CSV:** data jawaban terstruktur.
-   **JSON:** backup lengkap proyek untuk pemulihan.

Alur restore JSON:

1.  Pilih file JSON.
2.  Sistem memvalidasi struktur dan `schemaVersion`.
3.  Tinjau ringkasan isi backup.
4.  Pilih pemulihan sebagai proyek baru atau penggantian proyek yang
    dipilih.
5.  Konfirmasi tindakan jika ada data yang akan diganti.
6.  Sistem menyimpan data melalui transaksi IndexedDB.

## Rancangan Antarmuka

Arah visual mengikuti **Modern Productivity / Utilitarian Minimalism**:
bersih, profesional, minim ornamen, dan nyaman untuk penggunaan analisis
dalam waktu lama.

-   Warna primer: Indigo `#4F46E5`.
-   Latar utama: `#F8FAFC`.
-   Permukaan/card: `#FFFFFF`.
-   Teks utama: `#0F172A`.
-   Font utama: Plus Jakarta Sans.
-   Font kode/identifier: JetBrains Mono.
-   Layout workspace sesi desktop: tiga panel (daftar pertanyaan, editor
    jawaban, metadata).
-   Tablet: panel metadata dapat menjadi drawer.
-   Mobile: satu kolom dengan navigasi pertanyaan melalui drawer dan
    kontrol sebelumnya/selanjutnya.

## Batasan MVP

Hal-hal berikut tidak termasuk dalam MVP sesuai PRD:

-   Backend aplikasi dan database pusat.
-   Registrasi/login akun Interview Workspace.
-   Kolaborasi realtime beberapa pengguna.
-   Sinkronisasi dua arah Google Docs/Sheets.
-   Transkripsi audio otomatis.
-   Analisis AI otomatis tanpa persetujuan pengguna.
-   Sistem langganan atau pembayaran.
-   Pengelolaan hak akses tim/organisasi.

AI, jika ditambahkan pada tahap berikutnya, harus bersifat opsional,
meminta persetujuan sebelum mengirim data ke layanan eksternal, dan
menghasilkan saran yang dapat ditinjau pengguna---bukan temuan final
otomatis.

## Dokumentasi Proyek

Dokumen acuan pengembangan:

-   `PRD_INTERVIEW_WORKSPACE_REVISI_LOCAL_FIRST.md` --- kebutuhan
    produk, fitur, arsitektur, teknologi, UI/UX, model data, dan
    kriteria penerimaan.
-   `FLOW_INTERVIEW_WORKSPACE.md` --- alur sistem, percabangan proses,
    autosave, backup, restore, sinkronisasi, dan penanganan konflik.

------------------------------------------------------------------------

**Interview Workspace** --- satu ruang kerja untuk mengelola wawancara,
menjaga keterlacakan data, dan membantu proses analisis kualitatif
dengan penyimpanan yang dikendalikan pengguna.
