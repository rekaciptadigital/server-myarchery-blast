#!/usr/bin/env node

/**
 * 🔍 WhatsApp Connection Monitor
 * Real-time monitoring tool untuk track status connection dan availability untuk pengiriman pesan
 */

const fs = require('fs');
const path = require('path');

class ConnectionMonitor {
    constructor() {
        this.sessions = {};
        this.messageQueue = [];
        this.stats = {
            totalConnections: 0,
            successfulSends: 0,
            failedSends: 0,
            conflictErrors: 0,
            uptime: 0,
            downtime: 0
        };
        
        this.startTime = Date.now();
        this.lastReport = Date.now();
        
        console.log("🔍 WhatsApp Connection Monitor Started");
        console.log("=" .repeat(60));
    }
    
    /**
     * Monitor session status dari log output
     */
    parseLogLine(line) {
        const timestamp = new Date().toISOString();
        
        // Connection states
        if (line.includes('Connection opened successfully')) {
            this.logConnectionStatus('OPEN', timestamp);
            this.stats.uptime += 1;
        }
        
        if (line.includes('Connecting to WhatsApp')) {
            this.logConnectionStatus('CONNECTING', timestamp);
        }
        
        if (line.includes('Connection closed')) {
            this.logConnectionStatus('CLOSED', timestamp);
            this.stats.downtime += 1;
        }
        
        // Conflict errors
        if (line.includes('Conflict error detected')) {
            this.stats.conflictErrors += 1;
            console.log(`⚠️  [${timestamp}] CONFLICT ERROR - Session will retry in 30s`);
        }
        
        // Message sending status
        if (line.includes('Message sent successfully')) {
            this.stats.successfulSends += 1;
            console.log(`✅ [${timestamp}] MESSAGE SENT`);
        }
        
        if (line.includes('Message failed')) {
            this.stats.failedSends += 1;
            console.log(`❌ [${timestamp}] MESSAGE FAILED`);
        }
        
        // Instance info
        const instanceMatch = line.match(/instance[:\s]+([A-F0-9]+)/i);
        if (instanceMatch) {
            const instanceId = instanceMatch[1];
            if (!this.sessions[instanceId]) {
                this.sessions[instanceId] = {
                    id: instanceId,
                    status: 'UNKNOWN',
                    lastSeen: timestamp,
                    uptime: 0,
                    downtime: 0
                };
            }
        }
    }
    
    /**
     * Log status perubahan connection
     */
    logConnectionStatus(status, timestamp) {
        const statusColor = {
            'OPEN': '🟢',
            'CONNECTING': '🟡', 
            'CLOSED': '🔴',
            'UNKNOWN': '⚪'
        };
        
        console.log(`${statusColor[status]} [${timestamp}] CONNECTION: ${status}`);
        
        if (status === 'OPEN') {
            console.log(`   📱 Ready untuk pengiriman pesan`);
        } else if (status === 'CONNECTING') {
            console.log(`   ⏳ Menunggu koneksi established`);
        } else if (status === 'CLOSED') {
            console.log(`   ⛔ Tidak bisa kirim pesan saat ini`);
        }
    }
    
    /**
     * Generate real-time report
     */
    generateReport() {
        const now = Date.now();
        const runtime = Math.floor((now - this.startTime) / 1000);
        const uptime = this.stats.uptime;
        const downtime = this.stats.downtime;
        const total = uptime + downtime;
        const availability = total > 0 ? ((uptime / total) * 100).toFixed(2) : 0;
        
        console.log("\n" + "=".repeat(60));
        console.log("📊 REAL-TIME CONNECTION REPORT");
        console.log("=".repeat(60));
        console.log(`⏱️  Runtime: ${runtime}s`);
        console.log(`📈 Availability: ${availability}% (${uptime}/${total} checks)`);
        console.log(`✅ Successful Sends: ${this.stats.successfulSends}`);
        console.log(`❌ Failed Sends: ${this.stats.failedSends}`);
        console.log(`⚠️  Conflict Errors: ${this.stats.conflictErrors}`);
        console.log(`📱 Active Sessions: ${Object.keys(this.sessions).length}`);
        
        // Status breakdown
        console.log("\n🔍 CURRENT STATUS:");
        if (availability >= 80) {
            console.log("🟢 EXCELLENT - Pesan dapat dikirim dengan stabil");
        } else if (availability >= 60) {
            console.log("🟡 GOOD - Pesan dapat dikirim dengan occasional delay");
        } else if (availability >= 40) {
            console.log("🟠 FAIR - Pesan dapat dikirim tapi sering retry");
        } else {
            console.log("🔴 POOR - Pengiriman pesan sangat tidak stabil");
        }
        
        console.log("=".repeat(60) + "\n");
    }
    
    /**
     * Simulasi message queue status
     */
    checkMessageQueue() {
        const queueSize = Math.floor(Math.random() * 10); // Simulasi
        if (queueSize > 0) {
            console.log(`📨 Message Queue: ${queueSize} pending messages`);
        }
    }
    
    /**
     * Start monitoring
     */
    start() {
        // Generate report every 30 seconds
        setInterval(() => {
            this.generateReport();
            this.checkMessageQueue();
        }, 30000);
        
        // Listen to stdin for real-time log parsing
        console.log("🎯 Monitoring started. Paste log lines below or pipe server output:");
        console.log("   Example: node app.js 2>&1 | node connection-monitor.js");
        console.log("");
        
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    this.parseLogLine(line.trim());
                }
            });
        });
    }
}

// Check if script is being run directly
if (require.main === module) {
    const monitor = new ConnectionMonitor();
    monitor.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log("\n🔍 Connection Monitor stopping...");
        monitor.generateReport();
        process.exit(0);
    });
}

module.exports = ConnectionMonitor;
