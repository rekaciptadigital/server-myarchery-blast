#!/bin/bash

# WebSocket Health Monitor Launcher
# Starts the health monitoring service

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔧 WebSocket Health Monitor"
echo "============================"
echo "Project Root: $PROJECT_ROOT"
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

# Create logs directory if not exists
LOGS_DIR="$PROJECT_ROOT/logs"
if [ ! -d "$LOGS_DIR" ]; then
    echo "📁 Creating logs directory..."
    mkdir -p "$LOGS_DIR"
fi

# Check if health monitor script exists
MONITOR_SCRIPT="$SCRIPT_DIR/websocket-health-monitor.js"
if [ ! -f "$MONITOR_SCRIPT" ]; then
    echo "❌ Error: Monitor script not found at $MONITOR_SCRIPT"
    exit 1
fi

# Make script executable
chmod +x "$MONITOR_SCRIPT"

# Parse command line arguments
ACTION=${1:-start}

case "$ACTION" in
    start)
        echo "🚀 Starting Health Monitor..."
        echo ""
        
        # Check if already running
        if pgrep -f "websocket-health-monitor.js" > /dev/null; then
            echo "⚠️  Health Monitor is already running"
            echo "   Use './start-health-monitor.sh stop' to stop it first"
            exit 1
        fi
        
        # Start in background with pm2 if available
        if command -v pm2 &> /dev/null; then
            echo "Using PM2 to manage process..."
            pm2 start "$MONITOR_SCRIPT" \
                --name "websocket-health-monitor" \
                --log "$LOGS_DIR/health-monitor.log" \
                --error "$LOGS_DIR/health-monitor-error.log"
            
            echo ""
            echo "✅ Health Monitor started with PM2"
            echo "   View logs: pm2 logs websocket-health-monitor"
            echo "   Stop: pm2 stop websocket-health-monitor"
        else
            echo "PM2 not found, starting with nohup..."
            nohup node "$MONITOR_SCRIPT" > "$LOGS_DIR/health-monitor.log" 2>&1 &
            PID=$!
            echo $PID > "$LOGS_DIR/health-monitor.pid"
            
            echo ""
            echo "✅ Health Monitor started (PID: $PID)"
            echo "   View logs: tail -f $LOGS_DIR/health-monitor.log"
            echo "   Stop: ./start-health-monitor.sh stop"
        fi
        ;;
        
    stop)
        echo "🛑 Stopping Health Monitor..."
        
        if command -v pm2 &> /dev/null; then
            pm2 stop websocket-health-monitor
            pm2 delete websocket-health-monitor
        else
            if [ -f "$LOGS_DIR/health-monitor.pid" ]; then
                PID=$(cat "$LOGS_DIR/health-monitor.pid")
                if kill $PID 2>/dev/null; then
                    echo "✅ Health Monitor stopped (PID: $PID)"
                    rm "$LOGS_DIR/health-monitor.pid"
                else
                    echo "⚠️  Process not found, cleaning up PID file"
                    rm "$LOGS_DIR/health-monitor.pid"
                fi
            else
                # Try to find and kill by process name
                PIDS=$(pgrep -f "websocket-health-monitor.js")
                if [ ! -z "$PIDS" ]; then
                    kill $PIDS
                    echo "✅ Health Monitor stopped"
                else
                    echo "⚠️  Health Monitor is not running"
                fi
            fi
        fi
        ;;
        
    restart)
        echo "🔄 Restarting Health Monitor..."
        "$0" stop
        sleep 2
        "$0" start
        ;;
        
    status)
        echo "📊 Health Monitor Status"
        echo ""
        
        if command -v pm2 &> /dev/null; then
            pm2 show websocket-health-monitor
        else
            if pgrep -f "websocket-health-monitor.js" > /dev/null; then
                PIDS=$(pgrep -f "websocket-health-monitor.js")
                echo "✅ Health Monitor is running (PID: $PIDS)"
                
                # Show recent logs
                echo ""
                echo "Recent logs:"
                tail -n 20 "$LOGS_DIR/health-monitor.log"
            else
                echo "❌ Health Monitor is not running"
            fi
        fi
        ;;
        
    logs)
        echo "📋 Health Monitor Logs"
        echo "======================"
        echo ""
        
        if [ -f "$LOGS_DIR/health-monitor.log" ]; then
            tail -f "$LOGS_DIR/health-monitor.log"
        else
            echo "❌ Log file not found"
        fi
        ;;
        
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the health monitor"
        echo "  stop    - Stop the health monitor"
        echo "  restart - Restart the health monitor"
        echo "  status  - Show monitor status"
        echo "  logs    - Follow monitor logs"
        exit 1
        ;;
esac

exit 0
