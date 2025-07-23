/**
 * Simple Message Logger
 * Sistem logging sederhana yang dapat diintegrasikan dengan mudah
 */

const fs = require('fs');
const path = require('path');

class SimpleMessageLogger {
    constructor() {
        this.logDir = path.join(__dirname, 'logs');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * Log pesan yang berhasil dikirim
     */
    logSuccess(instanceId, phoneNumber, messageType, messageId) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            instanceId,
            phoneNumber,
            messageType,
            messageId,
            status: 'SUCCESS'
        };

        this.writeToFile('success', logEntry);
        console.log(`✅ [${instanceId}] Message sent to ${phoneNumber} - Type: ${messageType}`);
    }

    /**
     * Log pesan yang gagal dikirim
     */
    logFailure(instanceId, phoneNumber, messageType, error, errorDetails = {}) {
        const timestamp = new Date().toISOString();
        const errorInfo = this.parseError(error);
        
        const logEntry = {
            timestamp,
            instanceId,
            phoneNumber,
            messageType,
            error: errorInfo,
            errorDetails,
            status: 'FAILED'
        };

        this.writeToFile('failures', logEntry);
        
        // Console output dengan warna
        console.log(`❌ [${instanceId}] Message FAILED to ${phoneNumber}`);
        console.log(`   Error Type: ${errorInfo.type}`);
        console.log(`   Description: ${errorInfo.description}`);
        console.log(`   Solution: ${errorInfo.solution}`);
        console.log(`   Raw Error: ${error.message || error}`);
    }

    /**
     * Log bulk messaging progress
     */
    logBulkProgress(scheduleId, instanceId, sent, failed, total, currentPhone) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            scheduleId,
            instanceId,
            sent,
            failed,
            total,
            currentPhone,
            successRate: total > 0 ? ((sent / total) * 100).toFixed(2) + '%' : '0%'
        };

        this.writeToFile('bulk', logEntry);
        console.log(`📊 [${instanceId}] Bulk Progress: ${sent} sent, ${failed} failed, ${total} total (${logEntry.successRate})`);
    }

    /**
     * Parse error untuk mendapatkan informasi yang berguna
     */
    parseError(error) {
        const errorMessage = (error.message || error || '').toLowerCase();
        
        if (errorMessage.includes('stream errored (conflict)')) {
            return {
                type: 'CONFLICT_ERROR',
                description: 'Multiple WhatsApp sessions conflict - another device is using the same number',
                solution: 'Logout from other devices or restart the session'
            };
        } else if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
            return {
                type: 'TIMEOUT_ERROR',
                description: 'Request timeout - message took too long to send',
                solution: 'Check internet connection, reduce message frequency, or retry'
            };
        } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
            return {
                type: 'NOT_FOUND_ERROR',
                description: 'Phone number not found or not registered on WhatsApp',
                solution: 'Verify the phone number is correct and registered on WhatsApp'
            };
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
            return {
                type: 'RATE_LIMIT_ERROR',
                description: 'Too many messages sent in a short time',
                solution: 'Reduce sending frequency and add delays between messages'
            };
        } else if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
            return {
                type: 'AUTH_ERROR',
                description: 'Session expired or unauthorized',
                solution: 'Re-login to WhatsApp by scanning QR code'
            };
        } else if (errorMessage.includes('media') || errorMessage.includes('file')) {
            return {
                type: 'MEDIA_ERROR',
                description: 'Media file error - invalid format or size',
                solution: 'Check media file format, size, and accessibility'
            };
        } else if (errorMessage.includes('connection') || errorMessage.includes('network')) {
            return {
                type: 'CONNECTION_ERROR',
                description: 'Network or connection error',
                solution: 'Check internet connection and server status'
            };
        } else {
            return {
                type: 'UNKNOWN_ERROR',
                description: 'Unknown error occurred',
                solution: 'Check server logs for more details and contact support if needed'
            };
        }
    }

    /**
     * Write log entry to file
     */
    writeToFile(type, logEntry) {
        const date = new Date().toISOString().split('T')[0];
        const filename = `${type}-${date}.log`;
        const filepath = path.join(this.logDir, filename);
        
        const logLine = JSON.stringify(logEntry) + '\n';
        fs.appendFileSync(filepath, logLine, 'utf8');
    }

    /**
     * Get statistics for the last N hours
     */
    getStats(hours = 24) {
        const stats = {
            totalSent: 0,
            totalFailed: 0,
            successRate: 0,
            errorTypes: {},
            instanceStats: {},
            recentFailures: []
        };

        try {
            const date = new Date().toISOString().split('T')[0];
            const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));

            // Read success logs
            const successFile = path.join(this.logDir, `success-${date}.log`);
            if (fs.existsSync(successFile)) {
                const successLogs = fs.readFileSync(successFile, 'utf8');
                const successLines = successLogs.trim().split('\n').filter(line => line);
                
                successLines.forEach(line => {
                    try {
                        const entry = JSON.parse(line);
                        if (new Date(entry.timestamp) >= cutoffTime) {
                            stats.totalSent++;
                            stats.instanceStats[entry.instanceId] = stats.instanceStats[entry.instanceId] || { sent: 0, failed: 0 };
                            stats.instanceStats[entry.instanceId].sent++;
                        }
                    } catch (e) {}
                });
            }

            // Read failure logs
            const failureFile = path.join(this.logDir, `failures-${date}.log`);
            if (fs.existsSync(failureFile)) {
                const failureLogs = fs.readFileSync(failureFile, 'utf8');
                const failureLines = failureLogs.trim().split('\n').filter(line => line);
                
                failureLines.forEach(line => {
                    try {
                        const entry = JSON.parse(line);
                        if (new Date(entry.timestamp) >= cutoffTime) {
                            stats.totalFailed++;
                            
                            const errorType = entry.error?.type || 'UNKNOWN';
                            stats.errorTypes[errorType] = (stats.errorTypes[errorType] || 0) + 1;
                            
                            stats.instanceStats[entry.instanceId] = stats.instanceStats[entry.instanceId] || { sent: 0, failed: 0 };
                            stats.instanceStats[entry.instanceId].failed++;
                            
                            if (stats.recentFailures.length < 10) {
                                stats.recentFailures.push({
                                    timestamp: entry.timestamp,
                                    instanceId: entry.instanceId,
                                    phoneNumber: entry.phoneNumber,
                                    error: entry.error
                                });
                            }
                        }
                    } catch (e) {}
                });
            }

            // Calculate success rate
            const total = stats.totalSent + stats.totalFailed;
            stats.successRate = total > 0 ? ((stats.totalSent / total) * 100).toFixed(2) : 100;

        } catch (error) {
            console.error('Error reading stats:', error);
        }

        return stats;
    }

    /**
     * Generate and display report
     */
    showReport(hours = 24) {
        const stats = this.getStats(hours);
        
        console.log('\n📊 MESSAGE DELIVERY REPORT');
        console.log('='.repeat(50));
        console.log(`📅 Period: Last ${hours} hours`);
        console.log(`🕐 Generated: ${new Date().toLocaleString()}`);
        console.log('');
        
        console.log('📈 Overall Statistics:');
        console.log(`   ✅ Messages Sent: ${stats.totalSent}`);
        console.log(`   ❌ Messages Failed: ${stats.totalFailed}`);
        console.log(`   📊 Success Rate: ${stats.successRate}%`);
        console.log('');
        
        if (stats.totalFailed > 0) {
            console.log('🔍 Error Analysis:');
            Object.entries(stats.errorTypes)
                .sort(([,a], [,b]) => b - a)
                .forEach(([type, count]) => {
                    const percentage = ((count / stats.totalFailed) * 100).toFixed(1);
                    console.log(`   ${type}: ${count} (${percentage}%)`);
                });
            console.log('');
        }
        
        if (Object.keys(stats.instanceStats).length > 0) {
            console.log('📱 Instance Performance:');
            Object.entries(stats.instanceStats).forEach(([instance, data]) => {
                const total = data.sent + data.failed;
                const rate = total > 0 ? ((data.sent / total) * 100).toFixed(1) : 100;
                const status = rate >= 90 ? '🟢' : rate >= 70 ? '🟡' : '🔴';
                console.log(`   ${status} ${instance}: ${data.sent} sent, ${data.failed} failed (${rate}%)`);
            });
            console.log('');
        }
        
        if (stats.recentFailures.length > 0) {
            console.log('🕐 Recent Failures:');
            stats.recentFailures.slice(0, 5).forEach((failure, index) => {
                console.log(`   ${index + 1}. ${failure.phoneNumber} - ${failure.error?.type || 'UNKNOWN'}`);
                console.log(`      ${failure.error?.description || 'No description'}`);
                console.log(`      💡 ${failure.error?.solution || 'No solution available'}`);
                console.log('');
            });
        }
        
        console.log('='.repeat(50));
    }
}

// Export singleton instance
const logger = new SimpleMessageLogger();

module.exports = logger;