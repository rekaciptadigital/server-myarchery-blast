#!/bin/bash

# WhatsApp Network Connectivity Diagnostic Script
# Usage: ./scripts/diagnose-network.sh [instance_id]

INSTANCE_ID=${1:-"TEST"}
WHATSAPP_SERVERS=(
  "157.240.13.54"
  "31.13.65.49"
  "157.240.7.54"
)
PORT=443

echo "🔍 WhatsApp Network Connectivity Diagnostic"
echo "==========================================="
echo ""
echo "Instance ID: $INSTANCE_ID"
echo "Timestamp: $(date)"
echo ""

# 1. Check internet connectivity
echo "1️⃣  Testing general internet connectivity..."
if ping -c 3 8.8.8.8 > /dev/null 2>&1; then
  echo "   ✅ Internet connection: OK"
else
  echo "   ❌ Internet connection: FAILED"
  echo "   → Check your network connection"
  exit 1
fi
echo ""

# 2. Check DNS resolution
echo "2️⃣  Testing DNS resolution..."
if nslookup web.whatsapp.com > /dev/null 2>&1; then
  echo "   ✅ DNS resolution: OK"
  echo "   → web.whatsapp.com resolves to:"
  nslookup web.whatsapp.com | grep "Address:" | tail -n +2
else
  echo "   ❌ DNS resolution: FAILED"
  echo "   → Check your DNS settings"
fi
echo ""

# 3. Check WhatsApp server connectivity
echo "3️⃣  Testing WhatsApp server connectivity..."
for SERVER in "${WHATSAPP_SERVERS[@]}"; do
  echo -n "   Testing $SERVER:$PORT ... "
  
  # Try ping first
  if ping -c 1 -W 2 $SERVER > /dev/null 2>&1; then
    echo -n "PING:✅ "
  else
    echo -n "PING:❌ "
  fi
  
  # Try port connectivity
  if nc -z -w 2 $SERVER $PORT > /dev/null 2>&1; then
    echo "PORT:✅"
  else
    echo "PORT:❌"
  fi
done
echo ""

# 4. Check firewall rules (macOS)
echo "4️⃣  Checking firewall configuration..."
if command -v pfctl &> /dev/null; then
  FIREWALL_STATUS=$(sudo pfctl -s info 2>/dev/null | grep "Status:" | awk '{print $2}')
  if [ "$FIREWALL_STATUS" = "Enabled" ]; then
    echo "   ⚠️  Firewall: ENABLED"
    echo "   → May be blocking WhatsApp connections"
    echo "   → Check with: sudo pfctl -sr | grep 443"
  else
    echo "   ✅ Firewall: Disabled or not blocking"
  fi
else
  echo "   ℹ️  pfctl not available (not macOS)"
fi
echo ""

# 5. Check IPv6 connectivity
echo "5️⃣  Testing IPv6 connectivity..."
if ping6 -c 1 2001:4860:4860::8888 > /dev/null 2>&1; then
  echo "   ✅ IPv6: Working"
else
  echo "   ❌ IPv6: Not working"
  echo "   → WhatsApp uses IPv6 fallback"
  echo "   → This may cause ENETUNREACH errors"
fi
echo ""

# 6. Check VPN status
echo "6️⃣  Checking VPN connection..."
if ifconfig | grep -q "utun"; then
  echo "   ℹ️  VPN tunnel detected (utun interface)"
  echo "   → May affect WhatsApp connectivity"
else
  echo "   ℹ️  No VPN tunnel detected"
fi
echo ""

# 7. Traceroute to WhatsApp server
echo "7️⃣  Traceroute to WhatsApp server..."
echo "   Target: ${WHATSAPP_SERVERS[0]}"
traceroute -m 10 -w 2 ${WHATSAPP_SERVERS[0]} 2>&1 | head -n 12
echo ""

# 8. Recommendations
echo "📋 RECOMMENDATIONS"
echo "==================="

RECOMMENDATIONS=()

# Check if any server is reachable
REACHABLE=0
for SERVER in "${WHATSAPP_SERVERS[@]}"; do
  if nc -z -w 2 $SERVER $PORT > /dev/null 2>&1; then
    REACHABLE=1
    break
  fi
done

if [ $REACHABLE -eq 0 ]; then
  RECOMMENDATIONS+=("❌ CRITICAL: Cannot reach any WhatsApp servers")
  RECOMMENDATIONS+=("   → Check ISP blocking")
  RECOMMENDATIONS+=("   → Use VPN service")
  RECOMMENDATIONS+=("   → Contact hosting provider")
else
  RECOMMENDATIONS+=("✅ At least one WhatsApp server is reachable")
fi

# Check IPv6
if ! ping6 -c 1 2001:4860:4860::8888 > /dev/null 2>&1; then
  RECOMMENDATIONS+=("⚠️  IPv6 not working - may cause ENETUNREACH errors")
  RECOMMENDATIONS+=("   → Configure IPv6 on server")
  RECOMMENDATIONS+=("   → Or disable IPv6 in Node.js")
fi

# Check firewall
if [ "$FIREWALL_STATUS" = "Enabled" ]; then
  RECOMMENDATIONS+=("⚠️  Firewall enabled - may block outbound connections")
  RECOMMENDATIONS+=("   → Allow outbound HTTPS (port 443)")
fi

# Print recommendations
for REC in "${RECOMMENDATIONS[@]}"; do
  echo "$REC"
done
echo ""

# 9. Quick fixes
echo "🔧 QUICK FIXES"
echo "=============="
echo ""
echo "If circuit breaker is active for instance '$INSTANCE_ID':"
echo ""
echo "1. After fixing network issues, restart instance:"
echo "   curl -X POST http://localhost:8000/restart-instance \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"instance_id\": \"$INSTANCE_ID\"}'"
echo ""
echo "2. Or restart entire server:"
echo "   cd /Applications/MAMP/htdocs/server-myarchery-blast"
echo "   pkill -f 'node app.js' && sleep 2 && node app.js"
echo ""
echo "3. Monitor logs:"
echo "   tail -f logs/server-network-cb.log"
echo ""

# 10. Exit with appropriate code
if [ $REACHABLE -eq 1 ]; then
  echo "✅ Diagnostic complete - Network connectivity OK"
  exit 0
else
  echo "❌ Diagnostic complete - Network connectivity FAILED"
  exit 1
fi
