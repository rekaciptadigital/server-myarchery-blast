# Network Timeout Circuit Breaker - Panduan

## Overview

Implementasi **Network Timeout Circuit Breaker** untuk mencegah infinite retry loop ketika server tidak bisa koneksi ke WhatsApp servers karena masalah network (ETIMEDOUT, ENETUNREACH).

## Masalah yang Diselesaikan

### Sebelum Fix:
```
ETIMEDOUT 57.144.161.32:443
⏰ Scheduling retry for 68833D7671869 in 30000ms (error 408)
[retry 1]
ETIMEDOUT 57.144.161.32:443
⏰ Scheduling retry for 68833D7671869 in 30000ms (error 408)
[retry 2]
... terus berulang tanpa henti ...
```

Server **tidak crash** (sudah fixed sebelumnya), tapi **retry tanpa henti** saat network unreachable.

### Setelah Fix:
```
ETIMEDOUT 57.144.161.32:443
   🌐 Network timeout attempt 1/5
[retry 1]
ETIMEDOUT 57.144.161.32:443
   🌐 Network timeout attempt 2/5
[retry 2]
... sampai attempt ke-5 ...

🛑 🛑 🛑 NETWORK TIMEOUT CIRCUIT BREAKER ACTIVATED 🛑 🛑 🛑
Instance: 68833D7671869
Failed 5 consecutive times due to ETIMEDOUT/ENETUNREACH

👉 AUTOMATIC RETRIES STOPPED - MANUAL INTERVENTION REQUIRED

Possible causes:
  1. 🚫 Firewall blocking port 443
  2. 🌐 No VPN/proxy configured
  3. 🚦 ISP/datacenter blocking WhatsApp servers
  4. 🔌 IPv6 not configured properly

Next steps:
  1. Check network connectivity: ping 157.240.13.54
  2. Test port 443: telnet 157.240.13.54 443
  3. Configure VPN if needed
  4. After fixing, manually restart instance via API
```

## Implementasi Details

### 1. Tracking Variables

```javascript
const network_timeout_count = {}; // Track consecutive network timeouts
const MAX_NETWORK_TIMEOUTS = 5; // Stop after 5 consecutive failures
```

### 2. Enhanced scheduleRetry Function

```javascript
scheduleRetry: function(instance_id, delay, reason = '', is_network_timeout = false) {
  // Check circuit breaker BEFORE scheduling
  if (is_network_timeout) {
    network_timeout_count[instance_id] = (network_timeout_count[instance_id] || 0) + 1;
    
    if (network_timeout_count[instance_id] >= MAX_NETWORK_TIMEOUTS) {
      console.log('🛑 NETWORK TIMEOUT CIRCUIT BREAKER ACTIVATED');
      // Stop retrying, log detailed instructions
      return; // DON'T schedule retry
    }
  }
  
  // ... schedule retry logic ...
}
```

### 3. Error 408 Marking

```javascript
// Di lastDisconnect handler
const isNetworkTimeout = statusCode === 408; // 408 = Request Timeout
WAZIPER.scheduleRetry(instance_id, retryDelay, `error ${statusCode}`, isNetworkTimeout);
```

### 4. Reset Counter on Success

```javascript
resetNetworkTimeoutCounter: function(instance_id) {
  if (network_timeout_count[instance_id]) {
    console.log(`✅ Network timeout counter reset for ${instance_id}`);
    delete network_timeout_count[instance_id];
  }
}

// Called saat connection === "open"
WAZIPER.resetNetworkTimeoutCounter(instance_id);
```

## Error Codes yang Ditangani

- **408 (Request Timeout)**: Connection timeout ke WhatsApp servers
- **ETIMEDOUT**: TCP connection timeout
- **ENETUNREACH**: Network unreachable (IPv6 issues)

## Testing Steps

### 1. Trigger Network Timeout

```bash
# Request QR code generation
curl -X POST http://localhost:8000/qrcode \
  -H "Content-Type: application/json" \
  -d '{"instance_id": "TEST123"}'
```

### 2. Monitor Logs

```bash
tail -f logs/server-network-cb.log
```

Anda akan melihat:
```
⏰ Scheduling retry for TEST123 in 30000ms (error 408)
   🌐 Network timeout attempt 1/5

[setelah 30 detik]
🔄 Executing scheduled retry for TEST123

[error lagi]
⏰ Scheduling retry for TEST123 in 30000ms (error 408)
   🌐 Network timeout attempt 2/5

... ulangi sampai attempt 5 ...

🛑 🛑 🛑 NETWORK TIMEOUT CIRCUIT BREAKER ACTIVATED 🛑 🛑 🛑
👉 AUTOMATIC RETRIES STOPPED
```

### 3. Check Health Endpoint

```bash
curl http://localhost:8000/health | python3 -m json.tool
```

Status tetap:
```json
{
  "status": "success",
  "health_score": 100,
  "server_status": "running"
}
```

Server **TIDAK CRASH** meskipun circuit breaker activated.

## Troubleshooting Network Issues

### 1. Check WhatsApp Server Connectivity

```bash
# Test ping
ping 157.240.13.54

# Test port 443
telnet 157.240.13.54 443
# atau
nc -zv 157.240.13.54 443
```

### 2. Check Firewall

```bash
# macOS
sudo pfctl -sr | grep 443

# Linux
sudo iptables -L -n | grep 443
```

### 3. Check DNS Resolution

```bash
# Resolve WhatsApp servers
nslookup web.whatsapp.com
dig web.whatsapp.com
```

### 4. Test with VPN

Jika ISP/datacenter blocking WhatsApp:
- Gunakan VPN
- Atau proxy server
- Atau dedicated proxy untuk WhatsApp traffic

### 5. Manual Restart After Fix

Setelah fix network issues:

```bash
# Via API endpoint
curl -X POST http://localhost:8000/restart-instance \
  -H "Content-Type: application/json" \
  -d '{"instance_id": "68833D7671869"}'
```

Atau restart full server:
```bash
cd /Applications/MAMP/htdocs/server-myarchery-blast
pkill -f "node app.js"
sleep 2
node app.js
```

## Configuration

### Adjust Maximum Timeouts

Edit `waziper/waziper.js`:

```javascript
// Ubah dari 5 menjadi nilai lain
const MAX_NETWORK_TIMEOUTS = 10; // Allow 10 retries
```

**Recommended values:**
- **5**: Default, balance antara retry dan early detection
- **3**: Aggressive, stop cepat jika network issue
- **10**: Lenient, lebih banyak retry untuk network tidak stabil

### Adjust Retry Delay

```javascript
// Di lastDisconnect handler
const retryDelay = statusCode === 408 ? 60000 : 15000; 
// ^ Ubah 60000 untuk delay lebih lama
```

## Integration dengan Circuit Breaker Lainnya

System sekarang punya **2 circuit breakers**:

1. **Connection Failure Circuit Breaker** (sudah ada)
   - Threshold: 15 failures dalam 5 menit
   - Purpose: Prevent too many failures dari ANY error
   
2. **Network Timeout Circuit Breaker** (baru)
   - Threshold: 5 consecutive network timeouts
   - Purpose: Specific untuk ETIMEDOUT/ENETUNREACH

Keduanya bekerja **independent** dan **complementary**.

## Monitoring

### View Network Timeout Counter

Tambahkan ke health endpoint jika perlu:

```javascript
// Di app.js, /health endpoint
{
  network_timeout_instances: Object.keys(network_timeout_count).length,
  network_timeout_details: network_timeout_count
}
```

### Logs Pattern

Successful pattern:
```
⏰ Scheduling retry for X in 30000ms (error 408)
   🌐 Network timeout attempt 1/5
🔄 Executing scheduled retry for X
✅ Connection opened successfully
✅ Network timeout counter reset for X (was 1)
```

Circuit breaker activation:
```
   🌐 Network timeout attempt 5/5
🛑 🛑 🛑 NETWORK TIMEOUT CIRCUIT BREAKER ACTIVATED 🛑 🛑 🛑
```

## Summary

✅ **Server stabil**: Tidak crash meskipun network timeout berulang  
✅ **Smart retry**: Stop automatic retry setelah 5 kali consecutive network timeout  
✅ **Clear diagnostics**: Log memberikan exact steps untuk troubleshoot  
✅ **Auto recovery**: Counter reset otomatis saat connection berhasil  
✅ **Production ready**: Safe untuk environment dengan network tidak stabil

## Related Docs

- [08-websocket-crash-fix.md](08-websocket-crash-fix.md) - WebSocket safe close implementation
- [11-circuit-breaker-guide.md](11-circuit-breaker-guide.md) - Connection failure circuit breaker
- [12-crash-fix-summary.md](12-crash-fix-summary.md) - Comprehensive crash fixes
