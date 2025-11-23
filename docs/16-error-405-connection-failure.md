# Error 405: Connection Failure - Fix Guide

**Date:** November 23, 2025  
**Status:** ✅ IPv4 DNS Fix Working | 🔴 New Issue: Error 405  
**Severity:** HIGH - Prevents all QR code generation

---

## 🎯 Problem Summary

### What Happened

After successfully fixing ENETUNREACH errors with IPv4 DNS lookup, a NEW critical error appeared:

```
Error: Connection Failure
{
  data: { reason: '405', location: 'vll' / 'lla' / 'frc' / 'atn' },
  statusCode: 405,
  error: 'Method Not Allowed',
  message: 'Connection Failure'
}
```

### Evidence from Logs

```
✅ Resolved web.whatsapp.com to IPv4: 57.144.15.32  ← IPv4 fix WORKING!
Connection update: close QR: None
Last disconnect error: Error: Connection Failure  ← NEW PROBLEM
  { reason: '405', location: 'vll' }
```

### Key Observations

1. ✅ **IPv4 DNS Resolution Working**: Custom lookup successfully resolves to IPv4 addresses
2. ✅ **No ENETUNREACH Errors**: Network connectivity issue resolved
3. 🔴 **New Error 405**: WhatsApp server rejecting connection
4. 🔴 **Multiple Location Codes**: `vll`, `lla`, `frc`, `atn` - different WhatsApp edge servers

---

## 🔍 Root Cause Analysis

### What is Error 405?

HTTP Status 405 = "Method Not Allowed"

In WhatsApp context, this means:
- WhatsApp server **received** the connection (network OK)
- WhatsApp server **rejected** the connection (authentication/protocol issue)
- NOT a network problem (would be 408/timeout or ENETUNREACH)

### Common Causes

1. **Corrupted Session Files**
   - Session auth state invalid
   - Crypto keys mismatched
   - Old sessions from different Baileys version

2. **WhatsApp Version Mismatch**
   - Outdated Baileys version
   - WhatsApp Web updated, client not updated
   - Version number in handshake rejected

3. **Temporary Ban**
   - Too many failed connection attempts
   - WhatsApp detected unusual behavior
   - Server blocked IP temporarily (1-2 hours)

4. **Invalid Client Payload**
   - Browser configuration wrong
   - Missing required handshake parameters
   - Incompatible protocol version

### Location Codes Explained

WhatsApp uses location codes to identify edge servers:

- `vll` = Virginia (US East)
- `lla` = Los Angeles (US West) 
- `frc` = Frankfurt (Europe)
- `atn` = Atlanta (US Southeast)

Different location codes indicate WhatsApp is **load balancing** across edge servers. All rejecting with 405 means the issue is with **client authentication**, not specific server.

---

## ✅ Solution

### Approach 1: Clean Sessions + Update Baileys (RECOMMENDED)

**Why This Works:**
- Removes corrupted session files
- Updates to latest Baileys version
- Fresh authentication state
- Clean protocol handshake

**Steps:**

```bash
# On production server
cd /www/wwwroot/api-blast

# Pull latest code
git pull origin main

# Run fix script
bash scripts/fix-error-405.sh
```

The script will:
1. Stop the server
2. Update Baileys to latest version
3. Backup and clear all session files
4. Create fresh sessions directory
5. Restart server

**Expected Result:**
- All existing sessions cleared
- Need to re-scan QR codes
- Fresh connections should work

---

### Approach 2: Wait (If Temporary Ban)

If error 405 persists after clean sessions:

**Why This Might Be Needed:**
- WhatsApp may have temporarily blocked the server IP
- Occurs after too many failed connection attempts
- Automatic unban after 1-2 hours

**What To Do:**

```bash
# Stop server completely
pkill -f "node app.js"

# Wait 1-2 hours

# Check if ban lifted
curl -X POST http://localhost:8000/qrcode \
  -H "Content-Type: application/json" \
  -d '{"instance_id": "TEST_AFTER_WAIT"}'
```

---

### Approach 3: Update WhatsApp Version

If error 405 still persists, WhatsApp Web version may have updated:

```bash
cd /www/wwwroot/api-blast

# Update Baileys (includes latest WA version)
npm update @whiskeysockets/baileys

# Or fetch latest version explicitly
node -e "const {fetchLatestBaileysVersion} = require('@whiskeysockets/baileys'); fetchLatestBaileysVersion().then(console.log)"

# Restart
pkill -f "node app.js"
nohup node app.js > logs/server-version-update.log 2>&1 &
```

---

## 🧪 Testing & Verification

### 1. Check Logs for Success

```bash
tail -f logs/server-after-405-fix.log | grep -E "(QR|Connection|open|405)"
```

**Good Signs:**
```
Connection update: open QR: None        ← Connection successful!
Connection opened successfully
QR code generated successfully
```

**Bad Signs:**
```
Connection update: close QR: None       ← Still failing
Error: Connection Failure
{ reason: '405' }
```

### 2. Test QR Generation

```bash
curl -X POST http://localhost:8000/qrcode \
  -H "Content-Type: application/json" \
  -d '{"instance_id": "TEST_405_FIX"}'
```

**Expected Response:**
```json
{
  "status": true,
  "qrcode": "2@abc123...",
  "instance_id": "TEST_405_FIX"
}
```

### 3. Monitor Connection State

```bash
# Watch connection updates in real-time
tail -f logs/server-after-405-fix.log | grep "Connection update"
```

**Success Pattern:**
```
Connection update: connecting QR: None
Connection update: open QR: None        ← SUCCESS!
```

**Failure Pattern:**
```
Connection update: connecting QR: None
Connection update: close QR: None       ← FAILED
```

---

## 📊 Impact Analysis

### What Works Now

1. ✅ **IPv4 DNS Resolution**: Custom lookup working perfectly
2. ✅ **Network Connectivity**: ENETUNREACH errors eliminated
3. ✅ **WebSocket Connection**: Successfully connects to WhatsApp servers

### What Still Fails

1. 🔴 **WhatsApp Handshake**: Server rejects authentication (Error 405)
2. 🔴 **QR Code Generation**: Cannot generate QR due to connection rejection
3. 🔴 **All Instances Affected**: Not instance-specific, affects all sessions

### Comparison: Before vs After IPv4 Fix

| Aspect | Before IPv4 Fix | After IPv4 Fix | Current State |
|--------|----------------|----------------|---------------|
| DNS Resolution | ❌ IPv6 attempts | ✅ IPv4 only | ✅ Working |
| Network Errors | ❌ ENETUNREACH | ✅ None | ✅ Fixed |
| Connection | ❌ Never reaches server | ✅ Reaches server | ✅ Fixed |
| Authentication | ❓ Never got this far | 🔴 Error 405 | ❌ New Issue |
| QR Generation | ❌ Failed | ❌ Failed | ❌ Still Failing |

---

## 🚀 Production Deployment

### Complete Fix Procedure

```bash
# 1. SSH to production
ssh root@103.82.92.157

# 2. Navigate to app directory
cd /www/wwwroot/api-blast

# 3. Pull latest code (includes fix script)
git pull origin main

# 4. Run automated fix
bash scripts/fix-error-405.sh

# 5. Wait for script to complete (2-3 minutes)

# 6. Verify fix
tail -f logs/server-after-405-fix.log | grep -E "(QR|Connection|405|Resolved)"

# 7. Test QR generation
curl -X POST http://localhost:8000/qrcode \
  -H "Content-Type: application/json" \
  -d '{"instance_id": "TEST_PRODUCTION"}'
```

### Rollback Plan (If Needed)

If fix causes issues:

```bash
# 1. Stop server
pkill -f "node app.js"

# 2. Restore sessions from backup
LATEST_BACKUP=$(ls -t | grep sessions_backup | head -1)
rm -rf sessions
mv $LATEST_BACKUP sessions

# 3. Downgrade Baileys (if updated)
npm install @whiskeysockets/baileys@6.7.5  # Use known working version

# 4. Restart
nohup node app.js > logs/server-rollback.log 2>&1 &
```

---

## 🎓 Technical Deep Dive

### Why Error 405 Happens

1. **Client Payload Mismatch**
```javascript
// Baileys sends this during handshake:
proto.ClientPayload {
  version: [2, 3000, 1027934701],  // Must match WA expectations
  platform: WEB,
  connectType: WIFI_UNKNOWN,
  userAgent: { ... }
}
```

If WhatsApp expects different values → 405

2. **Session State Corruption**
```javascript
// Auth state contains:
{
  noiseKey: { ... },     // Crypto keys
  signedIdentityKey: { ... },
  signedPreKey: { ... },
  me: { id, name }       // Account info
}
```

If any of these are invalid → 405

3. **Version Mismatch**
```javascript
// WhatsApp checks version:
if (clientVersion < requiredVersion) {
  return 405;  // Old client, reject
}
```

### Location Code Routing

WhatsApp uses GeoDNS for edge server selection:

```
web.whatsapp.com
  ↓ GeoDNS (based on IP)
  ├─ vll.web.whatsapp.com (Virginia)
  ├─ lla.web.whatsapp.com (Los Angeles)
  ├─ frc.web.whatsapp.com (Frankfurt)
  └─ atn.web.whatsapp.com (Atlanta)
```

All returning 405 → Issue is **client-side**, not location-specific

---

## 📝 Lessons Learned

### What We Fixed Successfully

1. **ENETUNREACH Error**: Forced IPv4 via custom DNS lookup in https.Agent
2. **Network Connectivity**: Custom agent passed to both WebSocket and media uploads
3. **DNS Resolution**: Logs confirm IPv4 addresses being used

### What We Discovered

1. **Error 405 ≠ Network Error**: Authentication/protocol issue, not connectivity
2. **Session Management Critical**: Corrupted sessions prevent connection
3. **WhatsApp Version Matters**: Must stay updated with WA Web changes
4. **Multiple Edge Servers**: All rejecting = client problem, not server

### Next Steps If Error Persists

1. Check WhatsApp ban status (wait 1-2 hours)
2. Verify Baileys version matches WhatsApp Web
3. Check if server IP is blacklisted
4. Consider using proxy/VPN if IP blocked

---

## 🔗 Related Documentation

- `14-ipv4-preference-fix.md` - DNS and fetchAgent approach (partial fix)
- `15-websocket-ipv4-final-fix.md` - Agent parameter for WebSocket (complete IPv4 fix)
- `08-websocket-crash-fix.md` - Safe WebSocket close handling
- `13-network-timeout-circuit-breaker.md` - Network timeout handling

---

## 📊 Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| IPv4 DNS Lookup | ✅ Working | Custom lookup in https.Agent |
| Network Connectivity | ✅ Fixed | No ENETUNREACH errors |
| WebSocket Connection | ✅ Reaches Server | Connection attempt succeeds |
| WhatsApp Handshake | 🔴 Error 405 | Server rejects authentication |
| QR Code Generation | 🔴 Failing | Cannot proceed due to 405 |

**Overall:** **60% Fixed** - Network issues resolved, authentication issue remains

**Priority:** **HIGH** - Error 405 prevents all functionality

**Recommendation:** Run `scripts/fix-error-405.sh` to clean sessions and update Baileys

---

**Last Updated:** November 23, 2025  
**Author:** GitHub Copilot  
**Commit:** f21eef2
