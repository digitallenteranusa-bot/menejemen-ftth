# Pemetaan Core Fiber Optic (FO Core Map)

Aplikasi web untuk pencatatan dan dokumentasi pemetaan penggunaan core fiber optic pada jaringan FTTH (Fiber To The Home).

## Fitur

- **Multi Project** — Kelola beberapa project/area sekaligus
- **Manajemen Perangkat** — Catat OLT, OTB, ODC, ODP, Tiang beserta lokasi dan kapasitas
- **Pemetaan Core** — Mapping penggunaan core per koneksi antar perangkat dengan visualisasi warna tube/core standar fiber optic
- **Diagram Topologi** — Tampilan tree diagram hierarki jaringan (OLT → ODC → ODP, dll)
- **Tabel Detail** — Tabel lengkap status core per segmen (terpakai/kosong/cadangan)
- **Multi User** — Sistem login & registrasi, setiap user punya data masing-masing
- **Export/Import** — Backup dan restore data dalam format JSON
- **Cetak Laporan** — Print diagram dan tabel langsung dari browser
- **PWA Ready** — Bisa di-install sebagai aplikasi di HP/desktop

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3)
- **Frontend:** Vanilla HTML/CSS/JS (single page, tanpa framework)
- **Auth:** Express-session + scrypt hashing

---

## Panduan Instalasi di Proxmox (LXC Container)

### Persyaratan

| Komponen | Minimum |
|----------|---------|
| Container | LXC Ubuntu 22.04 / Debian 12 |
| RAM | 512 MB |
| Disk | 4 GB |
| Network | Bridge (DHCP atau Static IP) |

### Langkah 1 — Buat LXC Container

Di **Proxmox Web UI** (`https://<IP-PROXMOX>:8006`):

1. Klik **Create CT**
2. Isi konfigurasi:
   - **Hostname:** `fo-core-map`
   - **Template:** `ubuntu-22.04-standard` atau `debian-12-standard`
   - **Disk:** 4 GB
   - **CPU:** 1 core
   - **Memory:** 512 MB
   - **Network:** `vmbr0`, DHCP atau Static IP sesuai jaringan
3. Klik **Finish** lalu **Start** container
4. Buka **Console** container

### Langkah 2 — Update Sistem

```bash
apt update && apt upgrade -y
```

### Langkah 3 — Install Node.js 20

```bash
apt install -y curl git build-essential python3
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Verifikasi instalasi:

```bash
node -v
npm -v
```

Pastikan output menunjukkan Node.js v20.x dan npm v10.x.

### Langkah 4 — Clone Repository

```bash
cd /opt
git clone https://github.com/digitallenteranusa-bot/menejemen-ftth.git
```

### Langkah 5 — Install Dependencies

```bash
cd /opt/menejemen-ftth/web
npm install
```

### Langkah 6 — Test Jalankan Manual

```bash
node server.js
```

Jika berhasil, akan muncul:

```
FO Core Map berjalan di http://0.0.0.0:3000
```

Tekan `Ctrl+C` untuk menghentikan.

### Langkah 7 — Setup Systemd Service (Auto Start)

Salin file service yang sudah disediakan:

```bash
cp /opt/menejemen-ftth/web/fo-core-map.service /etc/systemd/system/
```

> **Catatan:** File service default menggunakan WorkingDirectory `/opt/fo-core-map`.
> Karena kita clone ke `/opt/menejemen-ftth/web`, edit path-nya:

```bash
sed -i 's|/opt/fo-core-map|/opt/menejemen-ftth/web|' /etc/systemd/system/fo-core-map.service
```

Aktifkan dan jalankan service:

```bash
systemctl daemon-reload
systemctl enable fo-core-map
systemctl start fo-core-map
```

Cek status:

```bash
systemctl status fo-core-map
```

Output harus menunjukkan **active (running)**.

### Langkah 8 — Akses Aplikasi

Cek IP container:

```bash
hostname -I
```

Buka browser dan akses:

```
http://<IP-CONTAINER>:3000
```

Contoh: `http://192.168.1.100:3000`

### Langkah 9 — Buat Akun Pertama

1. Di halaman login, klik tab **Daftar**
2. Isi username dan password
3. Klik **Daftar**
4. Anda langsung masuk ke aplikasi

---

## Mengubah Port

Jika ingin menjalankan di port lain (misal 8080):

```bash
sed -i 's|Environment=PORT=3000|Environment=PORT=8080|' /etc/systemd/system/fo-core-map.service
systemctl daemon-reload
systemctl restart fo-core-map
```

---

## Perintah Maintenance

```bash
# Restart aplikasi
systemctl restart fo-core-map

# Stop aplikasi
systemctl stop fo-core-map

# Lihat log realtime
journalctl -u fo-core-map -f

# Lihat log 50 baris terakhir
journalctl -u fo-core-map -n 50

# Cek status
systemctl status fo-core-map
```

---

## Update Aplikasi dari GitHub

```bash
cd /opt/menejemen-ftth
git pull
cd web
npm install
systemctl restart fo-core-map
```

---

## Backup & Restore Database

Database tersimpan di `/opt/menejemen-ftth/web/data.db`.

**Backup:**

```bash
cp /opt/menejemen-ftth/web/data.db /root/backup-fo-core-map-$(date +%Y%m%d).db
```

**Restore:**

```bash
systemctl stop fo-core-map
cp /root/backup-fo-core-map-XXXXXXXX.db /opt/menejemen-ftth/web/data.db
systemctl start fo-core-map
```

---

## Troubleshooting

### Aplikasi tidak bisa diakses

```bash
# Cek apakah service jalan
systemctl status fo-core-map

# Cek port terbuka
ss -tlnp | grep 3000

# Cek firewall
ufw status
ufw allow 3000/tcp    # jika firewall aktif
```

### Error saat npm install (build-essential)

```bash
apt install -y build-essential python3
npm rebuild
```

### Database corrupt

```bash
systemctl stop fo-core-map
cd /opt/menejemen-ftth/web
# Hapus database lama (SEMUA DATA HILANG)
rm data.db data.db-wal data.db-shm
systemctl start fo-core-map
# Database baru otomatis dibuat saat aplikasi start
```

### Melihat user terdaftar

```bash
cd /opt/menejemen-ftth/web
node -e "const D=require('better-sqlite3')('data.db'); console.table(D.prepare('SELECT id,username FROM users').all())"
```

---

## Struktur File

```
menejemen-ftth/
├── index.html          # Versi standalone (PWA, localStorage)
├── manifest.json       # PWA manifest
├── sw.js               # Service worker
├── icon-192.png        # Icon PWA
├── icon-512.png        # Icon PWA
├── README.md           # Dokumen ini
└── web/
    ├── server.js       # Backend Express + SQLite
    ├── package.json    # Dependencies
    ├── fo-core-map.service  # Systemd service file
    └── public/
        ├── index.html  # Aplikasi utama (dengan auth)
        └── login.html  # Halaman login/register
```

---

## Lisensi

Dibuat untuk kebutuhan internal dokumentasi jaringan FTTH.
