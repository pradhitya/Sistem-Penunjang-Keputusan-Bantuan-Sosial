# Sistem Pendukung Keputusan (SPK) Prioritas Bantuan Sosial

Aplikasi berbasis web menggunakan **Laravel** dan **React (TypeScript + Tailwind CSS)** untuk menentukan urutan prioritas calon penerima bantuan sosial kelurahan dengan metode **AHP–TOPSIS** (*Analytic Hierarchy Process* dan *Technique for Order of Preference by Similarity to Ideal Solution*).

> **Catatan:** Hasil pemeringkatan pada sistem ini merupakan urutan prioritas pendukung keputusan, bukan penetapan mutlak layak atau tidak layak.

---

## Fitur Utama

1. **Dashboard Ringkasan Prioritas**: Menampilkan total warga terdata, warga yang masuk pemeringkatan, warga tidak diikutkan (pindah/data RT-RW belum valid), data yang perlu dicek petugas, serta rincian kondisi penerimaan bantuan per Desil.
2. **Hasil Prioritas Calon Penerima Bantuan**: Menyajikan urutan peringkat warga dengan skor skala `0–100` dan pembagian 4 tingkat prioritas yang mudah dipahami (*Prioritas 1: Sangat Mendesak*, *Prioritas 2: Mendesak*, *Prioritas 3: Cukup Mendesak*, *Prioritas 4: Prioritas Rendah*) beserta rincian skor per warga.
3. **Kriteria & Bobot Penilaian (AHP)**: Mengatur bobot 3 kriteria utama (*Kondisi Ekonomi/Desil*, *Pemerataan Bantuan Sosial*, dan *Kondisi Wilayah RT/RW*) lengkap dengan kalkulator matriks perbandingan berpasangan AHP dan uji *Consistency Ratio (CR)*.
4. **Penyaringan & Pemeriksaan Data Petugas**: Memisahkan warga yang tidak masuk peringkat karena pindah domisili atau kesalahan RT/RW, mendeteksi anomali data (termasuk pemeriksaan 1 Kartu Keluarga lebih dari 1 penerima bantuan), serta menyediakan fitur koreksi langsung.
5. **Simulasi Perubahan Bobot (Uji Sensitivitas)**: Menguji kestabilan peringkat *Prioritas 1* terhadap 10 skenario variasi bobot menggunakan korelasi peringkat Spearman.
6. **Manajemen Data (.xlsx) & Akun Petugas**: Mendukung pembaruan data warga melalui unggah file Excel (`.xlsx`), ekspor hasil prioritas ke Excel, serta pengelolaan akun petugas.

---

## Cara Instalasi & Menjalankan Proyek

1. **Instal dependensi PHP dan JavaScript:**
   ```bash
   composer install
   npm install
   ```

2. **Salin konfigurasi environment:**
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

3. **Atur koneksi database MySQL pada file `.env`, lalu jalankan migrasi & seeder:**
   ```bash
   php artisan migrate --seed
   ```

4. **Bangun aset frontend dan jalankan server:**
   ```bash
   npm run build
   php artisan serve
   ```

5. **Menjalankan Unit Test perhitungan AHP–TOPSIS:**
   ```bash
   php artisan test --filter=AhpTopsisSpkTest
   ```
