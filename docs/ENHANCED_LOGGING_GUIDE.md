# Enhanced Message Logging System

Sistem logging yang telah ditingkatkan untuk memberikan informasi detail tentang kegagalan pengiriman pesan WhatsApp.

## 🎯 Tujuan

Sistem ini dibuat untuk mengatasi masalah yang Anda hadapi:
- **Mengetahui penyebab kegagalan pengiriman pesan**
- **Tracking pesan yang sukses vs gagal**
- **Informasi detail tentang error yang terjadi**
- **Monitoring real-time status pengiriman**

## 📁 File yang Dibuat

### Core System
- `enhanced-message-logging.js` - Sistem logging utama
- `message-logging-patch.js` - Patch untuk integrasi dengan kode existing
- `integrate-logging.js` - Script integrasi
- `logging-config.json` - Konfigurasi logging

### Tools & Commands
- `logging-commands.js` - CLI untuk melihat laporan
- `monitor-messages.js` - Dashboard monitoring real-time
- `setup-enhanced-logging.js` - Script setup otomatis

### Logs Directory
- `logs/message-attempts-YYYY-MM-DD.log` - Log percobaan pengiriman
- `logs/message-success-YYYY-MM-DD.log` - Log pesan berhasil
- `logs/message-failures-YYYY-MM-DD.log` - Log pesan gagal
- `logs/bulk-progress-YYYY-MM-DD.log` - Log progress bulk messaging

## 🚀 Cara Menggunakan

### 1. Restart Server
```bash
./restart-clean.sh
```

### 2. Monitor Real-time
```bash
node monitor-messages.js
```
Dashboard akan menampilkan:
- Statistik 24 jam terakhir
- Statistik 1 jam terakhir
- Status instance
- Error types yang paling sering

### 3. Lihat Laporan Detail
```bash
node logging-commands.js report
```

### 4. Lihat Statistik
```bash
node logging-commands.js stats 12  # 12 jam terakhir
```

### 5. Watch Mode (Real-time)
```bash
node logging-commands.js watch
```

## 📊 Informasi yang Akan Anda Dapatkan

### Ketika Pesan Gagal
Sekarang Anda akan melihat:

```json
{
  "timestamp": "2025-01-23T10:30:00.000Z",
  "instanceId": "6880714A02801",
  "chatId": "6281234567890@c.us",
  "error": {
    "type": "CONFLICT_ERROR",
    "message": "Stream Errored (conflict)",
    "description": "Multiple WhatsApp sessions conflict",
    "solution": "Logout from other devices or restart session"
  },
  "messageData": {
    "messageType": 1,
    "hasMedia": false,
    "phone_number": "6281234567890"
  },
  "status": "FAILED"
}
```

### Jenis Error yang Dideteksi

1. **CONFLICT_ERROR**
   - Penyebab: Multiple WhatsApp sessions
   - Solusi: Logout dari device lain atau restart session

2. **TIMEOUT_ERROR**
   - Penyebab: Request timeout
   - Solusi: Check koneksi internet atau retry

3. **NOT_FOUND_ERROR**
   - Penyebab: Nomor tidak terdaftar di WhatsApp
   - Solusi: Verifikasi nomor terdaftar di WhatsApp

4. **RATE_LIMIT_ERROR**
   - Penyebab: Terlalu banyak pesan dikirim
   - Solusi: Kurangi frekuensi pengiriman

5. **AUTH_ERROR**
   - Penyebab: Session expired
   - Solusi: Re-login ke WhatsApp

6. **MEDIA_ERROR**
   - Penyebab: Error file media
   - Solusi: Check format dan ukuran file

## 📈 Dashboard Monitoring

Dashboard real-time menampilkan:

```
📊 WAZIPER MESSAGE MONITORING DASHBOARD
============================================================
🕐 Last Updated: 23/01/2025, 17:30:00

📈 24 Hour Statistics:
   Total Failures: 15
   Success Rate: 92%
   Top Error Types:
     CONFLICT_ERROR: 8
     TIMEOUT_ERROR: 4
     NOT_FOUND_ERROR: 3

⚡ Last Hour:
   Failures: 2
   Recent Error Types:
     CONFLICT_ERROR: 2

📱 Instance Status:
   🟢 6880714A02801: 2 failures
   🔴 66F2681FCBB0A: 13 failures

💡 Commands: [R]efresh | [Q]uit | [F]ull Report
============================================================
```

## 🔧 Konfigurasi

Edit `logging-config.json` untuk menyesuaikan:

```json
{
  "logging": {
    "enabled": true,
    "logLevel": "detailed",
    "retentionDays": 30,
    "maxLogFileSize": "10MB"
  },
  "errorHandling": {
    "retryAttempts": 3,
    "retryDelay": 5000,
    "timeoutMs": 30000
  },
  "notifications": {
    "alertOnFailureRate": 0.1,
    "alertEmail": "[email]@example.com"
  }
}
```

## 🔍 Troubleshooting

### Jika Tidak Ada Log
1. Pastikan server sudah direstart
2. Coba kirim pesan test
3. Check permissions direktori logs

### Jika Error Saat Setup
1. Check permissions file
2. Pastikan Node.js modules terinstall
3. Backup waziper.js sudah dibuat

### Jika Dashboard Tidak Update
1. Restart monitor: `Ctrl+C` lalu jalankan lagi
2. Check apakah ada log files di direktori logs

## 📝 Log Format

### Message Attempts
```json
{
  "timestamp": "2025-01-23T10:30:00.000Z",
  "instanceId": "6880714A02801",
  "chatId": "6281234567890@c.us",
  "messageType": "bulk",
  "messageData": {
    "messageType": 1,
    "hasMedia": false,
    "caption": "Hello World"
  },
  "status": "ATTEMPTING"
}
```

### Message Success
```json
{
  "timestamp": "2025-01-23T10:30:01.000Z",
  "instanceId": "6880714A02801",
  "chatId": "6281234567890@c.us",
  "messageId": "3EB0C767D26A1D8E5C73",
  "deliveryInfo": {
    "type": "bulk",
    "phone_number": "6281234567890",
    "messageType": 1
  },
  "status": "SUCCESS"
}
```

### Message Failures
```json
{
  "timestamp": "2025-01-23T10:30:01.000Z",
  "instanceId": "6880714A02801",
  "chatId": "6281234567890@c.us",
  "error": {
    "type": "CONFLICT_ERROR",
    "message": "Stream Errored (conflict)",
    "description": "Multiple WhatsApp sessions conflict",
    "solution": "Logout from other devices or restart session"
  },
  "messageData": {
    "messageType": 1,
    "hasMedia": false,
    "phone_number": "6281234567890"
  },
  "status": "FAILED"
}
```

## 🎯 Manfaat Sistem Ini

1. **Visibility Penuh**: Anda sekarang bisa melihat exactly kenapa pesan gagal
2. **Proactive Monitoring**: Dashboard real-time untuk monitoring
3. **Historical Data**: Log tersimpan untuk analisis
4. **Actionable Insights**: Setiap error dilengkapi solusi
5. **Performance Tracking**: Track success rate dan pattern error

## 🔄 Maintenance

### Cleanup Log Files
```bash
# Hapus log lebih dari 30 hari
find logs/ -name "*.log" -mtime +30 -delete
```

### Backup Logs
```bash
# Backup logs bulanan
tar -czf logs-backup-$(date +%Y-%m).tar.gz logs/
```

### Reset Statistics
```bash
# Hapus semua logs (hati-hati!)
rm -rf logs/*
```

Dengan sistem ini, Anda sekarang memiliki visibilitas penuh terhadap proses pengiriman pesan dan dapat dengan mudah mengidentifikasi serta mengatasi masalah yang terjadi.