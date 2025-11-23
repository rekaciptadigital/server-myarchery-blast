# WhatsApp API Conflict Fix

## Masalah "Stream Errored (conflict)"

Error ini terjadi ketika ada multiple connections yang mencoba menggunakan session WhatsApp yang sama secara bersamaan. Ini adalah masalah umum pada aplikasi WhatsApp API menggunakan Baileys.

## Penyebab Utama

1. **Multiple Connections**: Beberapa instance mencoba connect dengan session yang sama
2. **Session Corruption**: File session yang rusak atau tidak valid
3. **Race Conditions**: Proses reconnection yang terjadi bersamaan
4. **Timeout Issues**: Connection timeout yang tidak ditangani dengan baik

## Solusi yang Diterapkan

### 1. Connection Management
- Menambahkan `connecting_sessions` tracker untuk mencegah multiple connections
- Improved cleanup logic saat disconnect
- Better error handling untuk status code 440 (conflict)

### 2. Session Cleanup
- Automatic cleanup untuk inactive sessions
- Periodic cleanup setiap 5 menit
- Proper WebSocket closure sebelum membuat connection baru

### 3. Timeout Configuration
- Increased connection timeout ke 60 detik
- Keep-alive interval 30 detik
- Retry delay yang lebih panjang untuk conflict errors

## Cara Menggunakan

### 1. Restart Server dengan Cleanup
```bash
# Restart normal
./restart-clean.sh

# Restart dengan membersihkan semua sessions
./restart-clean.sh --clean-sessions
```

### 2. Manual Session Management
```bash
# Lihat semua sessions
node fix-connection-conflicts.js list

# Check conflicts
node fix-connection-conflicts.js check

# Fix conflicts
node fix-connection-conflicts.js fix

# Clean specific session
node fix-connection-conflicts.js clean 6880714A02801

# Clean all sessions
node fix-connection-conflicts.js clean-all
```

### 3. Monitoring
```bash
# Monitor logs
tail -f server.log

# Check running processes
ps aux | grep node
```

## Pencegahan

### 1. Jangan Multiple Login
- Pastikan hanya satu aplikasi yang menggunakan nomor WhatsApp yang sama
- Logout dari WhatsApp Web/Desktop sebelum menggunakan API

### 2. Proper Session Management
- Jangan hapus session files secara manual saat aplikasi berjalan
- Gunakan endpoint `/logout` untuk disconnect dengan benar

### 3. Resource Management
- Monitor memory usage
- Restart server secara berkala jika diperlukan
- Clean up inactive sessions

## Troubleshooting

### Jika masih terjadi conflict:

1. **Stop semua proses**:
   ```bash
   pkill -f "node.*app.js"
   ```

2. **Clean semua sessions**:
   ```bash
   node fix-connection-conflicts.js clean-all
   ```

3. **Restart server**:
   ```bash
   ./restart-clean.sh
   ```

4. **Scan QR code baru** untuk setiap instance

### Jika error persisten:

1. Check apakah ada aplikasi lain yang menggunakan nomor yang sama
2. Logout dari semua device WhatsApp
3. Tunggu 5-10 menit sebelum mencoba lagi
4. Restart router/internet connection jika perlu

## Monitoring dan Logs

### Log Patterns untuk Conflict:
- `Stream Errored (conflict)`
- `Connection closed, reason: Error: Stream Errored (conflict)`
- `Conflict error detected`

### Healthy Connection Logs:
- `Connection opened successfully`
- `User info: {id: ...}`
- `Session updated successfully`

## Best Practices

1. **Single Instance per Number**: Satu nomor WhatsApp hanya untuk satu instance
2. **Proper Shutdown**: Selalu gunakan endpoint logout sebelum restart
3. **Regular Cleanup**: Jalankan cleanup secara berkala
4. **Monitor Resources**: Watch memory dan CPU usage
5. **Backup Sessions**: Backup session files sebelum major updates

## Support

Jika masalah masih berlanjut setelah mengikuti panduan ini:

1. Check server.log untuk error details
2. Pastikan tidak ada multiple processes yang running
3. Verify database connections
4. Check network connectivity

---

**Note**: Perubahan ini sudah diterapkan pada file `waziper/waziper.js` dan akan aktif setelah restart server.