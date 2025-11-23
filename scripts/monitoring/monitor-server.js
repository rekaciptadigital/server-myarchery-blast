#!/usr/bin/env node

/**
 * 🔍 WhatsApp Server Monitor
 * Script untuk monitoring kesehatan server WhatsApp secara real-time
 * 
 * Fitur:
 * - Monitor memory usage
 * - Track session connections
 * - Monitor error rates
 * - Alert system untuk masalah
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

class ServerMonitor {
    constructor() {
        this.baseUrl = 'http://localhost:8000';
        this.logFile = path.join(__dirname, 'logs', 'server-monitor.log');
        this.alertThresholds = {
            memoryUsage: 80, // percentage
            errorRate: 10,   // percentage
            responseTime: 5000 // milliseconds
        };
        
        this.ensureLogDirectory();
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            memoryUsage: [],
            sessionCount: 0
        };
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data,
            pid: process.pid,
            memory: process.memoryUsage()
        };

        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
        if (Object.keys(data).length > 0) {
            console.log('  Data:', JSON.stringify(data, null, 2));
        }

        // Write to log file
        fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    }

    async checkServerHealth() {
        const startTime = Date.now();
        
        try {
            // Test server endpoint
            const response = await axios.get(`${this.baseUrl}/`, {
                timeout: this.alertThresholds.responseTime
            });
            
            const responseTime = Date.now() - startTime;
            this.stats.totalRequests++;
            this.stats.successfulRequests++;
            this.stats.responseTimes.push(responseTime);

            // Keep only last 100 response times
            if (this.stats.responseTimes.length > 100) {
                this.stats.responseTimes = this.stats.responseTimes.slice(-100);
            }

            this.log('info', 'Server health check passed', {
                responseTime,
                status: response.status,
                message: response.data?.message || 'N/A'
            });

            return {
                healthy: true,
                responseTime,
                status: response.status
            };

        } catch (error) {
            this.stats.totalRequests++;
            this.stats.failedRequests++;

            this.log('error', 'Server health check failed', {
                error: error.message,
                code: error.code,
                responseTime: Date.now() - startTime
            });

            return {
                healthy: false,
                error: error.message,
                responseTime: Date.now() - startTime
            };
        }
    }

    getMemoryUsage() {
        const usage = process.memoryUsage();
        const memoryMB = {
            rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
            external: Math.round(usage.external / 1024 / 1024 * 100) / 100
        };

        this.stats.memoryUsage.push(memoryMB);
        
        // Keep only last 60 measurements (1 hour if checking every minute)
        if (this.stats.memoryUsage.length > 60) {
            this.stats.memoryUsage = this.stats.memoryUsage.slice(-60);
        }

        return memoryMB;
    }

    calculateStats() {
        const errorRate = this.stats.totalRequests > 0 
            ? (this.stats.failedRequests / this.stats.totalRequests) * 100 
            : 0;

        const avgResponseTime = this.stats.responseTimes.length > 0
            ? this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length
            : 0;

        const currentMemory = this.getMemoryUsage();

        return {
            uptime: process.uptime(),
            totalRequests: this.stats.totalRequests,
            successfulRequests: this.stats.successfulRequests,
            failedRequests: this.stats.failedRequests,
            errorRate: Math.round(errorRate * 100) / 100,
            avgResponseTime: Math.round(avgResponseTime),
            currentMemory,
            sessionCount: this.stats.sessionCount
        };
    }

    async checkAlerts(stats) {
        const alerts = [];

        // Memory usage alert
        if (stats.currentMemory.heapUsed > this.alertThresholds.memoryUsage) {
            alerts.push({
                type: 'MEMORY_HIGH',
                message: `High memory usage: ${stats.currentMemory.heapUsed}MB`,
                severity: 'warning'
            });
        }

        // Error rate alert
        if (stats.errorRate > this.alertThresholds.errorRate) {
            alerts.push({
                type: 'HIGH_ERROR_RATE',
                message: `High error rate: ${stats.errorRate}%`,
                severity: 'critical'
            });
        }

        // Response time alert
        if (stats.avgResponseTime > this.alertThresholds.responseTime) {
            alerts.push({
                type: 'SLOW_RESPONSE',
                message: `Slow response time: ${stats.avgResponseTime}ms`,
                severity: 'warning'
            });
        }

        // Process alerts
        for (const alert of alerts) {
            this.log('alert', alert.message, {
                type: alert.type,
                severity: alert.severity,
                stats
            });
        }

        return alerts;
    }

    async displayStatus() {
        console.clear();
        
        const healthCheck = await this.checkServerHealth();
        const stats = this.calculateStats();
        const alerts = await this.checkAlerts(stats);

        console.log('🔍 WHATSAPP SERVER MONITOR');
        console.log('='.repeat(50));
        console.log(`📅 Time: ${new Date().toLocaleString()}`);
        console.log(`🕐 Uptime: ${Math.floor(stats.uptime / 60)}m ${Math.floor(stats.uptime % 60)}s`);
        console.log('');

        // Server Health
        const healthIcon = healthCheck.healthy ? '🟢' : '🔴';
        console.log(`${healthIcon} Server Status: ${healthCheck.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
        console.log(`⚡ Response Time: ${healthCheck.responseTime}ms`);
        console.log('');

        // Statistics
        console.log('📊 Statistics:');
        console.log(`   📈 Total Requests: ${stats.totalRequests}`);
        console.log(`   ✅ Successful: ${stats.successfulRequests}`);
        console.log(`   ❌ Failed: ${stats.failedRequests}`);
        console.log(`   📉 Error Rate: ${stats.errorRate}%`);
        console.log(`   ⏱️  Avg Response: ${stats.avgResponseTime}ms`);
        console.log('');

        // Memory Usage
        console.log('💾 Memory Usage:');
        console.log(`   🔹 RSS: ${stats.currentMemory.rss}MB`);
        console.log(`   🔹 Heap Used: ${stats.currentMemory.heapUsed}MB`);
        console.log(`   🔹 Heap Total: ${stats.currentMemory.heapTotal}MB`);
        console.log(`   🔹 External: ${stats.currentMemory.external}MB`);
        console.log('');

        // Sessions
        console.log(`📱 Active Sessions: ${stats.sessionCount}`);
        console.log('');

        // Alerts
        if (alerts.length > 0) {
            console.log('🚨 ALERTS:');
            alerts.forEach(alert => {
                const icon = alert.severity === 'critical' ? '🔴' : '🟡';
                console.log(`   ${icon} ${alert.message}`);
            });
            console.log('');
        }

        console.log('🔄 Next check in 30 seconds... (Press Ctrl+C to stop)');
        console.log('='.repeat(50));
    }

    async start() {
        this.log('info', 'Server monitor started');
        console.log('🚀 Starting WhatsApp Server Monitor...');
        
        // Initial check
        await this.displayStatus();
        
        // Set up periodic monitoring
        setInterval(async () => {
            await this.displayStatus();
        }, 30000); // Check every 30 seconds

        // Graceful shutdown
        process.on('SIGINT', () => {
            this.log('info', 'Server monitor stopped');
            console.log('\n👋 Monitor stopped. Goodbye!');
            process.exit(0);
        });
    }

    // Generate detailed report
    async generateReport() {
        const stats = this.calculateStats();
        
        const report = {
            timestamp: new Date().toISOString(),
            uptime: stats.uptime,
            statistics: {
                requests: {
                    total: stats.totalRequests,
                    successful: stats.successfulRequests,
                    failed: stats.failedRequests,
                    errorRate: stats.errorRate
                },
                performance: {
                    averageResponseTime: stats.avgResponseTime,
                    memoryUsage: stats.currentMemory
                },
                sessions: {
                    active: stats.sessionCount
                }
            },
            memoryHistory: this.stats.memoryUsage.slice(-10), // Last 10 measurements
            responseTimeHistory: this.stats.responseTimes.slice(-10) // Last 10 measurements
        };

        const reportFile = path.join(__dirname, 'logs', `monitor-report-${new Date().toISOString().split('T')[0]}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        this.log('info', 'Report generated', { reportFile });
        return report;
    }
}

// CLI Usage
if (require.main === module) {
    const monitor = new ServerMonitor();
    
    const command = process.argv[2];
    
    if (command === 'report') {
        monitor.generateReport().then(report => {
            console.log('📋 Report Generated:');
            console.log(JSON.stringify(report, null, 2));
        });
    } else {
        monitor.start();
    }
}

module.exports = ServerMonitor;
