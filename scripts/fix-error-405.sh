#!/bin/bash

# Script to fix Error 405: Connection Failure from WhatsApp
# This error occurs when session files are corrupted or WhatsApp version is outdated

echo "🔧 Fixing Error 405: Connection Failure"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on production
if [ -d "/www/wwwroot/api-blast" ]; then
    APP_DIR="/www/wwwroot/api-blast"
    echo "📍 Detected production environment"
else
    APP_DIR="/Applications/MAMP/htdocs/server-myarchery-blast"
    echo "📍 Detected development environment"
fi

cd "$APP_DIR"

echo ""
echo "${YELLOW}=== Step 1: Stop Server ===${NC}"
pkill -f "node app.js"
sleep 3
echo "${GREEN}✅ Server stopped${NC}"

echo ""
echo "${YELLOW}=== Step 2: Update Baileys to Latest Version ===${NC}"
npm update @whiskeysockets/baileys
echo "${GREEN}✅ Baileys updated${NC}"

echo ""
echo "${YELLOW}=== Step 3: Backup Current Sessions ===${NC}"
if [ -d "sessions" ]; then
    BACKUP_DIR="sessions_backup_$(date +%Y%m%d_%H%M%S)"
    mv sessions "$BACKUP_DIR"
    echo "${GREEN}✅ Sessions backed up to $BACKUP_DIR${NC}"
else
    echo "${YELLOW}⚠️  No sessions directory found${NC}"
fi

echo ""
echo "${YELLOW}=== Step 4: Create Fresh Sessions Directory ===${NC}"
mkdir -p sessions
chmod 755 sessions
echo "${GREEN}✅ Fresh sessions directory created${NC}"

echo ""
echo "${YELLOW}=== Step 5: Clear Node Modules Cache (Optional) ===${NC}"
read -p "Clear node_modules cache? This will take 2-3 minutes (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf node_modules package-lock.json
    npm install
    echo "${GREEN}✅ Dependencies reinstalled${NC}"
else
    echo "${YELLOW}⚠️  Skipped cache clear${NC}"
fi

echo ""
echo "${YELLOW}=== Step 6: Start Server ===${NC}"
nohup node app.js > logs/server-after-405-fix.log 2>&1 &
sleep 5
echo "${GREEN}✅ Server started${NC}"

echo ""
echo "${GREEN}=== Fix Complete! ===${NC}"
echo ""
echo "📋 What was done:"
echo "  1. ✅ Server stopped"
echo "  2. ✅ Baileys updated to latest version"
echo "  3. ✅ Old sessions backed up and cleared"
echo "  4. ✅ Fresh sessions directory created"
echo "  5. ✅ Server restarted"
echo ""
echo "🔍 Check logs:"
echo "  tail -f logs/server-after-405-fix.log | grep -E '(QR|Connection|405|Resolved)'"
echo ""
echo "🧪 Test QR generation:"
echo "  curl -X POST http://localhost:8000/qrcode -H 'Content-Type: application/json' -d '{\"instance_id\": \"TEST_405_FIX\"}'"
echo ""
echo "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "  - All existing WhatsApp sessions are cleared"
echo "  - You need to re-scan QR codes for all instances"
echo "  - If error 405 persists, wait 1-2 hours (WhatsApp temporary ban)"
echo ""
