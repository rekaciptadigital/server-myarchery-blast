#!/bin/bash

# 🔄 WhatsApp Server Auto-Restart Script
# Script untuk monitoring dan auto-restart server jika terjadi masalah

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_FILE="$SCRIPT_DIR/app.js"
PID_FILE="$SCRIPT_DIR/server.pid"
LOG_FILE="$SCRIPT_DIR/logs/restart.log"
ERROR_LOG="$SCRIPT_DIR/logs/error.log"

# Buat direktori logs jika belum ada
mkdir -p "$SCRIPT_DIR/logs"

# Function untuk logging
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $level: $message" | tee -a "$LOG_FILE"
}

# Function untuk check apakah server berjalan
is_server_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0  # Server berjalan
        else
            rm -f "$PID_FILE"
            return 1  # Server tidak berjalan
        fi
    else
        return 1  # PID file tidak ada
    fi
}

# Function untuk start server
start_server() {
    log_message "INFO" "Starting WhatsApp server..."
    
    cd "$SCRIPT_DIR"
    
    # Kill existing node processes yang mungkin berjalan
    pkill -f "node app.js" 2>/dev/null || true
    
    # Start server di background
    nohup node "$APP_FILE" > "$LOG_FILE" 2> "$ERROR_LOG" &
    local pid=$!
    
    # Simpan PID
    echo "$pid" > "$PID_FILE"
    
    # Wait sebentar untuk memastikan server start
    sleep 3
    
    if is_server_running; then
        log_message "SUCCESS" "Server started successfully with PID: $pid"
        return 0
    else
        log_message "ERROR" "Failed to start server"
        return 1
    fi
}

# Function untuk stop server
stop_server() {
    log_message "INFO" "Stopping WhatsApp server..."
    
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        
        # Graceful shutdown
        kill -TERM "$pid" 2>/dev/null || true
        
        # Wait up to 10 seconds for graceful shutdown
        local count=0
        while [ $count -lt 10 ] && ps -p "$pid" > /dev/null 2>&1; do
            sleep 1
            ((count++))
        done
        
        # Force kill if still running
        if ps -p "$pid" > /dev/null 2>&1; then
            log_message "WARN" "Force killing server process"
            kill -KILL "$pid" 2>/dev/null || true
        fi
        
        rm -f "$PID_FILE"
        log_message "INFO" "Server stopped"
    else
        log_message "WARN" "No PID file found, killing all node app.js processes"
        pkill -f "node app.js" 2>/dev/null || true
    fi
}

# Function untuk restart server
restart_server() {
    log_message "INFO" "Restarting WhatsApp server..."
    stop_server
    sleep 2
    start_server
}

# Function untuk check server health
check_health() {
    # Test dengan curl ke endpoint server
    local response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/ 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        return 0  # Healthy
    else
        log_message "ERROR" "Health check failed - HTTP response: $response"
        return 1  # Unhealthy
    fi
}

# Function untuk monitor memory usage
check_memory() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        local memory_mb=$(ps -p "$pid" -o rss= 2>/dev/null | awk '{print $1/1024}' || echo "0")
        local memory_threshold=500  # 500MB threshold
        
        if (( $(echo "$memory_mb > $memory_threshold" | bc -l) )); then
            log_message "WARN" "High memory usage detected: ${memory_mb}MB (threshold: ${memory_threshold}MB)"
            return 1
        fi
    fi
    return 0
}

# Function untuk check error logs
check_errors() {
    if [ -f "$ERROR_LOG" ]; then
        # Check for recent critical errors (last 5 minutes)
        local recent_errors=$(tail -n 100 "$ERROR_LOG" | grep -c "Error:\|Exception:\|timeout\|ECONNREFUSED" || echo "0")
        
        if [ "$recent_errors" -gt 5 ]; then
            log_message "ERROR" "Multiple errors detected in recent logs: $recent_errors errors"
            return 1
        fi
    fi
    return 0
}

# Function untuk monitoring loop
monitor_loop() {
    local restart_count=0
    local max_restarts=5
    local restart_window=3600  # 1 hour window
    local last_restart_time=0
    
    log_message "INFO" "Starting monitoring loop..."
    
    while true; do
        local current_time=$(date +%s)
        
        # Reset restart count if outside window
        if [ $((current_time - last_restart_time)) -gt $restart_window ]; then
            restart_count=0
        fi
        
        # Check if server is running
        if ! is_server_running; then
            log_message "ERROR" "Server not running, attempting restart..."
            
            if [ $restart_count -ge $max_restarts ]; then
                log_message "CRITICAL" "Maximum restart attempts reached ($max_restarts). Manual intervention required."
                exit 1
            fi
            
            if start_server; then
                restart_count=$((restart_count + 1))
                last_restart_time=$current_time
            else
                log_message "CRITICAL" "Failed to restart server. Exiting."
                exit 1
            fi
        else
            # Server running, check health
            if ! check_health; then
                log_message "ERROR" "Health check failed, restarting server..."
                restart_server
                restart_count=$((restart_count + 1))
                last_restart_time=$current_time
            elif ! check_memory; then
                log_message "WARN" "Memory usage high, restarting server..."
                restart_server
                restart_count=$((restart_count + 1))
                last_restart_time=$current_time
            elif ! check_errors; then
                log_message "ERROR" "Error pattern detected, restarting server..."
                restart_server
                restart_count=$((restart_count + 1))
                last_restart_time=$current_time
            else
                # All checks passed
                log_message "DEBUG" "All health checks passed"
            fi
        fi
        
        # Wait before next check
        sleep 30
    done
}

# Function untuk show status
show_status() {
    echo "🔍 WhatsApp Server Status"
    echo "========================"
    
    if is_server_running; then
        local pid=$(cat "$PID_FILE")
        echo "✅ Server Status: RUNNING (PID: $pid)"
        
        # Memory usage
        local memory_mb=$(ps -p "$pid" -o rss= 2>/dev/null | awk '{print $1/1024}' || echo "0")
        echo "💾 Memory Usage: ${memory_mb}MB"
        
        # Uptime
        local start_time=$(ps -p "$pid" -o lstart= 2>/dev/null || echo "Unknown")
        echo "⏰ Started: $start_time"
        
        # Health check
        if check_health; then
            echo "🟢 Health Check: PASSED"
        else
            echo "🔴 Health Check: FAILED"
        fi
    else
        echo "❌ Server Status: NOT RUNNING"
    fi
    
    echo ""
    echo "📋 Recent logs:"
    if [ -f "$LOG_FILE" ]; then
        tail -n 5 "$LOG_FILE"
    else
        echo "No logs found"
    fi
}

# Main script logic
case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        show_status
        ;;
    monitor)
        monitor_loop
        ;;
    health)
        if check_health; then
            echo "✅ Server is healthy"
            exit 0
        else
            echo "❌ Server health check failed"
            exit 1
        fi
        ;;
    *)
        echo "🔄 WhatsApp Server Management Script"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|monitor|health}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the server"
        echo "  stop    - Stop the server"
        echo "  restart - Restart the server"
        echo "  status  - Show server status"
        echo "  monitor - Start monitoring loop (auto-restart)"
        echo "  health  - Check server health"
        echo ""
        echo "Examples:"
        echo "  $0 start          # Start server"
        echo "  $0 monitor        # Start with auto-restart monitoring"
        echo "  $0 status         # Check current status"
        exit 1
        ;;
esac
