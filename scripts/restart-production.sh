#!/bin/bash
echo "🔄 Restarting production server with IPv4 fix..."
echo ""

# SSH to production and restart
ssh root@prod-myarchery << 'ENDSSH'
cd /www/wwwroot/api-blast

echo "1️⃣ Stopping current server..."
pkill -f "node app.js"
sleep 3

echo "2️⃣ Starting server with IPv4 fix..."
nohup node app.js > logs/server-ipv4.log 2>&1 &
echo "Server started with PID: $!"

echo "3️⃣ Waiting for startup (5 seconds)..."
sleep 5

echo ""
echo "4️⃣ Verifying IPv4 fix is active..."
tail -n 50 logs/server-ipv4.log | grep -E "(DNS resolution|HTTPS agent|WAZIPER)" | head -n 10

echo ""
echo "✅ Server restarted!"
echo ""
echo "📊 Monitor logs with:"
echo "   tail -f /www/wwwroot/api-blast/logs/server-ipv4.log"
ENDSSH

echo ""
echo "🎯 Next steps:"
echo "   1. Test QR generation"
echo "   2. Monitor for ENETUNREACH (should be ZERO)"
echo "   3. Check connection success rate"
