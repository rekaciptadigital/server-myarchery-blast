#!/bin/bash

# Quick Server Management Script
# Usage: ./server-manager-fixed.sh [start|stop|restart|status|reset-all]

PORT=8000
LOG_FILE="logs/server.log"

case "$1" in
    start)
        echo "🚀 Starting WAZIPER server..."
        cd /Applications/MAMP/htdocs/server-myarchery-blast
        node app.js > $LOG_FILE 2>&1 &
        echo "✅ Server started on port $PORT"
        echo "📝 Logs: tail -f $LOG_FILE"
        ;;
    
    stop)
        echo "⏹️  Stopping WAZIPER server..."
        pkill -f "node app.js"
        echo "✅ Server stopped"
        ;;
    
    restart)
        echo "🔄 Restarting WAZIPER server..."
        pkill -f "node app.js"
        sleep 2
        cd /Applications/MAMP/htdocs/server-myarchery-blast
        node app.js > $LOG_FILE 2>&1 &
        echo "✅ Server restarted"
        ;;
    
    status)
        echo "📊 Server Status:"
        curl -s http://localhost:$PORT/health | python3 -m json.tool
        ;;
    
    reset-all)
        echo "🔄 Resetting all circuit breakers..."
        
        # Get all instance IDs from sessions directory
        for dir in sessions/*/; do
            if [ -d "$dir" ]; then
                instance_id=$(basename "$dir")
                echo "Resetting: $instance_id"
                curl -s -X POST "http://localhost:$PORT/reset-circuit-breaker/$instance_id"
                echo ""
            fi
        done
        
        echo "✅ All circuit breakers reset"
        ;;
    
    logs)
        echo "📝 Showing logs (Ctrl+C to exit)..."
        tail -f $LOG_FILE
        ;;
    
    health)
        echo "🏥 Health Check:"
        curl -s http://localhost:$PORT/health | python3 -m json.tool
        ;;
    
    *)
        echo "Usage: $0 {start|stop|restart|status|reset-all|logs|health}"
        echo ""
        echo "Commands:"
        echo "  start      - Start the server"
        echo "  stop       - Stop the server"
        echo "  restart    - Restart the server"
        echo "  status     - Show server status"
        echo "  reset-all  - Reset all circuit breakers"
        echo "  logs       - Show live logs"
        echo "  health     - Quick health check"
        exit 1
        ;;
esac
