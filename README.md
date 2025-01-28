# Bot QRIS Dinamis (Dynamic QRIS Bot)

Bot Telegram sederhana untuk mengubah QRIS Statis menjadi QRIS Dinamis dengan nominal yang dapat disesuaikan. Cocok untuk UMKM atau siapa saja yang ingin menggunakan QRIS dengan nominal yang fleksibel.

## ✨ Fitur

- Mengubah QRIS Statis menjadi QRIS Dinamis
- Mengatur nominal pembayaran sesuai keinginan
- Otomatis menghapus file QRIS yang sudah kadaluarsa (khusus bot Telegram)
- Mudah digunakan melalui chat Telegram

## 🚀 Cara Menggunakan Bot

1. Mulai chat dengan bot menggunakan command `/start`
2. Kirim foto QRIS Statis yang ingin diubah
3. Bot akan meminta nominal pembayaran
4. Masukkan nominal yang diinginkan (angka saja, tanpa titik atau koma)
5. Bot akan mengirimkan QRIS Dinamis yang berlaku selama 30 menit

## 📘 Tentang qrDinamis.js

File `qrDinamis.js` adalah modul dasar yang bisa digunakan untuk membuat versi QRIS Dinamis lainnya. Modul ini menyediakan fungsi-fungsi penting:

- `qrisDinamis(qrstring, nominal, path)`: Membuat QRIS Dinamis dan menyimpannya sebagai file
- `qrisDinamisBuffer(qrstring, nominal)`: Membuat QRIS Dinamis dalam bentuk buffer
- `toCRC16(str)`: Fungsi helper untuk menghitung CRC16

Anda bisa menggunakan modul ini untuk membuat:
- Versi web app
- Versi desktop app
- Integrasi dengan platform chat lain
- API endpoint
- Dan berbagai implementasi lainnya

## ⚠️ Catatan Penting

Khusus untuk Bot Telegram:
- QRIS Dinamis berlaku selama 30 menit
- Bot akan otomatis membersihkan file temporary setiap 30 menit
- Nominal yang dimasukkan akan ditambah 3 digit random di belakangnya
- Pastikan foto QRIS yang dikirim jelas dan tidak blur

Untuk Penggunaan Module qrDinamis.js:
- Tidak ada batasan waktu kadaluarsa
- Bisa diimplementasikan sesuai kebutuhan
- Nominal bisa disesuaikan tanpa perlu penambahan digit random
- Format input QRIS bisa disesuaikan dengan kebutuhan implementasi

## 🤝 Kontribusi

Silakan buat Issue atau Pull Request jika ingin berkontribusi pada project ini.

## 📝 Lisensi

[MIT License](LICENSE)
