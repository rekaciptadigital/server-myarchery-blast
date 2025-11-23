# Circuit Breaker & Crash Prevention Guide

## 🛡️ Overview

Circuit breaker adalah mekanisme proteksi untuk mencegah server crash akibat terlalu banyak connection failures.

## 🔴 Kapan Circuit Breaker Aktif?

Circuit breaker akan aktif ketika:
- **15 atau lebih** connection failures dalam **5 menit terakhir**
- Auto-reset setelah **10 menit**

## ⚙️ Behavior Changes

### Before (Crash):
```
❌ throw new Error() → Server CRASH
```

### After (Graceful):
```
✅ return null → Server tetap berjalan
✅ Response error message yang jelas
✅ Auto-recovery setelah cooldown period
```

## 🔧 Manual Reset Circuit Breaker

### Method 1: Via API
```bash
curl -X POST "http://localhost:8000/reset-circuit-breaker/YOUR_INSTANCE_ID"
```

### Method 2: Via Script
```bash
chmod +x scripts/reset-circuit-breaker.sh
./scripts/reset-circuit-breaker.sh YOUR_INSTANCE_ID
```

### Method 3: Via Browser
```
http://localhost:8000/reset-circuit-breaker/YOUR_INSTANCE_ID
```

## 📊 Monitor Circuit Breaker Status

### Check Health Status
```bash
curl -X GET "http://localhost:8000/health"
```

Response:
```json
{
  "status": "success",
  "message": "Server is running",
  "data": {
    "server_status": "running",
    "total_instances": 2,
    "active_connections": 0,
    "connecting": 0,
    "circuit_breaker_activations": 2,
    "total_retry_attempts": 15,
    "total_recent_failures": 20,
    "health_score": 45
  }
}
```

### Check Specific Instance
```bash
curl -X GET "http://localhost:8000/circuit-breaker-status/YOUR_INSTANCE_ID"
```

## 🚨 Common Errors & Solutions

### Error: "Circuit breaker activated"
**Penyebab:** Terlalu banyak connection failures dalam waktu singkat

**Solusi:**
1. Reset circuit breaker:
   ```bash
   curl -X POST "http://localhost:8000/reset-circuit-breaker/YOUR_INSTANCE_ID"
   ```

2. Tunggu 10 menit untuk auto-reset

3. Periksa koneksi internet dan WhatsApp server status

### Error: "ETIMEDOUT" atau "WebSocket Error"
**Penyebab:** 
- Koneksi internet tidak stabil
- WhatsApp server sedang down
- Firewall blocking connection

**Solusi:**
1. Cek koneksi internet
2. Coba gunakan VPN jika di-block
3. Tunggu beberapa saat jika WhatsApp server bermasalah
4. Reset circuit breaker setelah masalah teratasi

### Error: "Unable to create session"
**Penyebab:** Circuit breaker masih active

**Solusi:**
1. Manual reset via API
2. Atau tunggu auto-reset (10 menit)

## 📈 Threshold Configuration

Current settings (di `waziper.js`):
```javascript
// Circuit breaker threshold
if (failed_connections[instance_id].length >= 15) {
  // Activate circuit breaker
}

// Time window for failure count
const timeWindow = 300000; // 5 minutes

// Auto-reset timeout
const resetTimeout = 600000; // 10 minutes
```

### Cara Mengubah Threshold

Edit file `waziper/waziper.js` line ~92:
```javascript
// Lebih ketat (activate lebih cepat)
if (failed_connections[instance_id].length >= 10) {

// Lebih longgar (activate lebih lambat)
if (failed_connections[instance_id].length >= 20) {
```

## 🔄 Auto-Recovery Process

1. **Detection**: 15 failures detected in 5 minutes
2. **Activation**: Circuit breaker activated, returns null
3. **Cooldown**: 10 minutes waiting period
4. **Reset**: Automatic reset of counters
5. **Recovery**: Normal operation resumed

## 💡 Best Practices

### 1. Manual QR Request
Ketika user request QR code secara manual, circuit breaker akan di-reset otomatis:
```javascript
// Auto-reset pada manual QR request
if (failed_connections[instance_id].length >= 15) {
  failed_connections[instance_id] = [];
  retry_attempts[instance_id] = 0;
}
```

### 2. Monitoring
Selalu monitor health status:
```bash
watch -n 5 'curl -s http://localhost:8000/health | jq'
```

### 3. Graceful Degradation
Server akan tetap melayani request lain meskipun ada instance yang circuit breaker-nya aktif.

### 4. Error Handling
Selalu handle response dengan proper error checking:
```javascript
const response = await fetch('/get_qrcode?...');
if (response.circuit_breaker) {
  // Show user-friendly message
  alert('Please try again in a few minutes');
}
```

## 🎯 Benefits

✅ **No More Crashes**: Server tidak akan crash karena connection errors
✅ **Auto-Recovery**: Otomatis recovery setelah cooldown
✅ **Manual Override**: Bisa di-reset manual jika diperlukan
✅ **Better UX**: User mendapat error message yang jelas
✅ **Resource Protection**: Prevent resource exhaustion

## 📞 Emergency Commands

```bash
# 1. Reset semua circuit breakers
curl -X POST "http://localhost:8000/reset-circuit-breaker/instance_1"
curl -X POST "http://localhost:8000/reset-circuit-breaker/instance_2"

# 2. Check health
curl -X GET "http://localhost:8000/health"

# 3. Restart server (if needed)
pkill -f "node app.js"
node app.js &

# 4. Monitor logs
tail -f logs/app.log
```

## 🔍 Debugging

Enable detailed logging untuk circuit breaker:
```javascript
console.log("🔍 Circuit breaker status:", {
  instance_id,
  failures: failed_connections[instance_id].length,
  retry_attempts: retry_attempts[instance_id],
  threshold: 15
});
```

## 📚 Related Documentation

- [08-websocket-crash-fix.md](./08-websocket-crash-fix.md)
- [07-root-cause-conflict-solution.md](./07-root-cause-conflict-solution.md)
- [09-quick-reference.md](./09-quick-reference.md)
