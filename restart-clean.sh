#!/bin/bash

echo "🔄 Restarting WhatsApp API with cleanup..."

# Kill existing Node.js processes
echo "🛑 Stopping existing processes..."
pkill -f "node.*app.js" || true
pkill -f "node.*waziper" || true

# Wait for processes to stop
sleep 2

# Clean up sessions if requested
if [ "$1" = "--clean-sessions" ]; then
    echo "🧹 Cleaning all sessions..."
    node fix-connection-conflicts.js clean-all
fi

# Check for conflicts
echo "🔍 Checking for conflicts..."
node fix-connection-conflicts.js check

# Fix any detected conflicts
echo "🔧 Fixing conflicts..."
node fix-connection-conflicts.js fix

# Clear logs
echo "🗑️  Clearing old logs..."
> server.log

# Start the server
echo "🚀 Starting server..."
nohup node app.js > server.log 2>&1 &

# Get the process ID
PID=$!
echo "✅ Server started with PID: $PID"

# Wait a moment and check if it's still running
sleep 3
if ps -p $PID > /dev/null; then
    echo "✅ Server is running successfully"
    echo "📋 To view logs: tail -f server.log"
    echo "🛑 To stop server: kill $PID"
else
    echo "❌ Server failed to start. Check server.log for errors"
    tail -20 server.log
fi