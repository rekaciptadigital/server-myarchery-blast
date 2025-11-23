#!/bin/bash

# Quick script to create new WhatsApp session with unique instance ID
# Usage: bash create-new-session.sh YOUR_ACCESS_TOKEN

if [ -z "$1" ]; then
    echo "❌ Error: Access token required"
    echo "Usage: bash create-new-session.sh YOUR_ACCESS_TOKEN"
    exit 1
fi

ACCESS_TOKEN=$1
API_URL="http://localhost:8000"

echo "🔧 Creating new WhatsApp session..."
echo ""

# Step 1: Generate unique instance ID
echo "📝 Step 1: Generating unique instance ID..."
RESPONSE=$(curl -s "$API_URL/generate-instance-id")
INSTANCE_ID=$(echo $RESPONSE | jq -r '.instance_id')

if [ "$INSTANCE_ID" = "null" ] || [ -z "$INSTANCE_ID" ]; then
    echo "❌ Failed to generate instance ID"
    echo "$RESPONSE"
    exit 1
fi

echo "✅ Instance ID generated: $INSTANCE_ID"
echo ""

# Step 2: Request QR code
echo "📱 Step 2: Requesting QR code..."
QR_RESPONSE=$(curl -s "$API_URL/get_qrcode?access_token=$ACCESS_TOKEN&instance_id=$INSTANCE_ID")
echo "$QR_RESPONSE" | jq

STATUS=$(echo $QR_RESPONSE | jq -r '.status')
if [ "$STATUS" = "success" ]; then
    echo ""
    echo "✅ QR code generated successfully!"
    echo "📋 Instance ID: $INSTANCE_ID"
    echo ""
    echo "🔍 Monitor logs:"
    echo "   tail -f logs/server.log | grep $INSTANCE_ID"
    echo ""
    echo "🧪 Check status:"
    echo "   curl 'http://localhost:8000/instance?access_token=$ACCESS_TOKEN&instance_id=$INSTANCE_ID'"
else
    echo ""
    echo "❌ Failed to generate QR code"
    echo "Instance ID: $INSTANCE_ID"
fi
