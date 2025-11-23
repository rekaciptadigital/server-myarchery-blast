#!/bin/bash

# Script to reset circuit breaker for a specific instance
# Usage: ./reset-circuit-breaker.sh <instance_id>

if [ -z "$1" ]; then
    echo "❌ Error: Instance ID required"
    echo "Usage: ./reset-circuit-breaker.sh <instance_id>"
    exit 1
fi

INSTANCE_ID=$1
PORT=${2:-8000}

echo "🔄 Resetting circuit breaker for instance: $INSTANCE_ID"
echo "📡 Server port: $PORT"

RESPONSE=$(curl -s -X POST "http://localhost:$PORT/reset-circuit-breaker/$INSTANCE_ID")

echo "Response: $RESPONSE"

# Check if successful
if echo "$RESPONSE" | grep -q '"status":"success"'; then
    echo "✅ Circuit breaker reset successfully!"
    echo ""
    echo "You can now try to get QR code again:"
    echo "curl -X GET \"http://localhost:$PORT/get_qrcode?access_token=YOUR_TOKEN&instance_id=$INSTANCE_ID\""
else
    echo "❌ Failed to reset circuit breaker"
    echo "Response: $RESPONSE"
fi
