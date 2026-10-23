✨ Tentang Paper Snap

**Paper Snap** adalah website photobooth yang mengubah kamera devicemu menjadi photobooth. Cukup buka, izinkan kamera, berpose, dan unduh hasilnya.

Dibuat oleh **Snap Club** dengan HTML, CSS, dan JavaScript murni. Seluruh proses foto berjalan **di browser kamu sendiri**, jadi foto tidak pernah dikirim ke server mana pun. 🔒

---

## 🎞️ Flow aplikasi

```
 Klik Start  →  Izinkan kamera  →  Pilih filter & countdown  →  Ambil 3 foto
                                                                      ↓
        Unduh PNG  ←  Atur frame, caption & tanggal  ←  Build Photo Strip
```

---

🌟 Fitur

### 🏠 Landing Page
| Bagian | Isi |
|---|---|
| **Home** | Judul, dekorasi animasi, dan tombol **Start** |
| **How To Use** | Kartu kertas warna-warni yang bergerak otomatis (carousel) |
| **Reviews** | Memo di papan kayu, berganti otomatis tiap **3,5 detik** |
| **The Team** | Foto anggota tim dengan animasi *pop-in* saat di-scroll |
| **Transisi** | Efek **tirai panggung** saat masuk dan keluar photobooth |

### 📷 Photobooth
- **Live preview ala cermin**: tampilan kamera dibalik horizontal supaya natural.
- **Countdown** 3 / 5 / 10 detik (default 3 detik) lengkap dengan efek suara.
- **Flash putih + suara shutter** setiap kali foto diambil.
- **3 slot foto**: klik slot untuk memilih, 🔍 untuk memperbesar, ✕ untuk menghapus satu foto.
- **Upload dari galeri**: tidak punya kamera? Tetap bisa pakai foto dari perangkat (bisa pilih beberapa sekaligus).
- **Retake All**: ulang seluruh sesi dengan sekali klik.

### 🎨 Filter (bisa beda di tiap slot!)
| Filter | Efek |
|---|---|
| **Normal** | Warna asli |
| **B&W** | Hitam putih |
| **Sepia** | Cokelat hangat |
| **Vintage** | Nuansa retro klasik |
| **Cool Blue** | Tone dingin kebiruan |

Filter bisa dipilih sebelum memotret **dan** diubah setelah foto diambil, karena foto asli disimpan terpisah dari hasil filter.

### 🖼️ Photostrip
- Tiga foto digabung menjadi **strip vertikal** seperti hasil mesin photobooth.
- **Warna frame**: 5 pilihan preset (Cream, Putih, Charcoal, Pink, Biru Pastel) + **color picker bebas**.
- **Caption custom** (maks. 35 karakter). Jika kosong, otomatis memakai `PHOTOBOOTH STUDIO`.
- **Stempel tanggal** yang bisa diaktifkan/dimatikan (format Indonesia).
- **Warna teks otomatis** menyesuaikan terang/gelapnya frame agar tetap terbaca.
- **Download PNG** dengan nama file otomatis, misalnya `photobooth-2026-10-23-14-30-00.png`.

### 🛟 Pendukung
- Layout **responsif** untuk desktop dan layar kecil.
- **Penanganan error kamera**: pesan jelas + tombol *Try Again*.
- Kamera **otomatis dimatikan** saat keluar dari photobooth.

---

🚀 Cara Menjalankan

Tidak perlu install apa pun. Pilih salah satu cara:

**Opsi 1: VS Code**
1. Buka folder proyek di VS Code.
2. Install ekstensi **Live Server**.
3. Klik kanan `index.html` → **Open with Live Server**.

**Opsi 2: Python**
```bash
cd folder-proyek
python -m http.server 8000
# buka http://localhost:8000
```

**Opsi 3: Node.js**
```bash
npx serve .
```

> ⚠️ **Penting:** browser hanya mengizinkan akses kamera lewat **`localhost`** atau **HTTPS**. Jika `index.html` dibuka langsung dengan `file://`, kamera bisa gagal aktif.

---

📖 Cara Memakai

1. Klik **Start** di halaman utama.
2. Klik **Activate Camera** dan izinkan akses kamera.
3. Pilih **filter** dan durasi **countdown**.
4. Tekan tombol **shutter merah** untuk memotret. Ulangi sampai 3 slot terisi (atau pakai **Upload Photo(s)**).
5. Klik **Build Photo Strip**.
6. Atur **warna frame**, **caption**, dan **tanggal**.
7. Klik **💾 Download** untuk menyimpan PNG.

> 💡 **Tips:** Mau ganti satu foto saja? Klik slotnya, ambil ulang, atau ganti filternya tanpa mengulang semuanya.

---

🗂️ Struktur Proyek

```
paper-snap/
├── index.html      # Struktur halaman: landing page + photobooth
├── landing.css     # Gaya & animasi landing page, deklarasi font
├── landing.js      # Navigasi scroll, animasi tim, rotasi review
├── style.css       # Gaya photobooth: kamera, filter, frame, strip
├── script.js       # Logika utama: kamera, capture, filter, strip, download
└── Aset/           # Gambar dekorasi, foto tim, dan font
```

---

🧰 Teknologi

| Teknologi | Dipakai untuk |
|---|---|
| **HTML5 / CSS3** | Struktur, layout responsif, animasi |
| **JavaScript (Vanilla)** | Seluruh logika aplikasi |
| **MediaDevices API** | Mengakses kamera lewat `getUserMedia()` |
| **Canvas API** | Menangkap foto, menerapkan filter, menyusun photostrip |
| **FileReader API** | Membaca foto yang diunggah |
| **Web Audio API** | Suara countdown dan shutter |
| **Google Fonts** | *Fraunces* dan *Space Grotesk* (butuh koneksi internet) |

---


👥 Tim Snap Club

**Abel · Felta · Dhiska · Rosi · Kafka**

---

📝 Catatan

- Tidak ada penyimpanan ke database atau server; foto hanya ada di memori browser sampai kamu mengunduhnya.

**Selamat bergaya! 📸✨**
