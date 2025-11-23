/**
 * Enhanced Message Logging System
 * Sistem logging yang lebih detail untuk tracking pengiriman pesan
 */

const fs = require('fs');
const path = require('path');

class MessageLogger {
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
     * Log detail pengiriman pesan
     */
    logMessageAttempt(instanceId, chatId, messageType, messageData) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            instanceId,
            chatId,
            messageType,
            messageData: this.sanitizeMessageData(messageData),
            status: 'ATTEMPTING'
        };

        this.writeLog('message-attempts', logEntry);
        return logEntry;
    }

    /**
     * Log hasil pengiriman pesan (sukses)
     */
    logMessageSuccess(instanceId, chatId, messageId, deliveryInfo) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            instanceId,
            chatId,
            messageId,
            deliveryInfo,
            status: 'SUCCESS'
        };

        this.writeLog('message-success', logEntry);
        return logEntry;
    }

    /**
     * Log kegagalan pengiriman pesan dengan detail error
     */
    logMessageFailure(instanceId, chatId, error, messageData) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            instanceId,
            chatId,
            error: this.parseError(error),
            messageData: this.sanitizeMessageData(messageData),
            status: 'FAILED'
        };

        this.writeLog('message-failures', logEntry);
        return logEntry;
    }

    /**
     * Log bulk messaging progress
     */
    logBulkProgress(scheduleId, instanceId, totalSent, totalFailed, currentPhone, error = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            scheduleId,
            instanceId,
            totalSent,
            totalFailed,
            currentPhone,
            error: error ? this.parseError(error) : null,
            status: error ? 'BULK_ERROR' : 'BULK_PROGRESS'
        };

        this.writeLog('bulk-progress', logEntry);
        return logEntry;
    }

    /**
     * Parse error untuk mendapatkan informasi yang berguna
     */
    parseError(error) {
        if (!error) return null;

        const errorInfo = {
            message: error.message || 'Unknown error',
            name: error.name || 'Error',
            stack: error.stack ? error.stack.split('\n').slice(0, 5) : null
        };

        // Parse specific WhatsApp errors
        if (error.message) {
            const message = error.message.toLowerCase();
            
            if (message.includes('stream errored (conflict)')) {
                errorInfo.type = 'CONFLICT_ERROR';
                errorInfo.description = 'Multiple WhatsApp sessions conflict';
                errorInfo.solution = 'Logout from other devices or restart session';
            } else if (message.includes('timed out')) {
                errorInfo.type = 'TIMEOUT_ERROR';
                errorInfo.description = 'Request timeout';
                errorInfo.solution = 'Check internet connection or retry';
            } else if (message.includes('not found')) {
                errorInfo.type = 'NOT_FOUND_ERROR';
                errorInfo.description = 'Phone number not found on WhatsApp';
                errorInfo.solution = 'Verify phone number is registered on WhatsApp';
            } else if (message.includes('rate limit')) {
                errorInfo.type = 'RATE_LIMIT_ERROR';
                errorInfo.description = 'Too many messages sent';
                errorInfo.solution = 'Reduce sending frequency';
            } else if (message.includes('unauthorized')) {
                errorInfo.type = 'AUTH_ERROR';
                errorInfo.description = 'Session expired or unauthorized';
                errorInfo.solution = 'Re-login to WhatsApp';
            } else if (message.includes('media')) {
                errorInfo.type = 'MEDIA_ERROR';
                errorInfo.description = 'Media file error';
                errorInfo.solution = 'Check media file format and size';
            } else {
                errorInfo.type = 'UNKNOWN_ERROR';
                errorInfo.description = 'Unknown error occurred';
                errorInfo.solution = 'Check logs for more details';
            }
        }

        return errorInfo;
    }

    /**
     * Sanitize message data untuk logging (hapus data sensitif)
     */
    sanitizeMessageData(data) {
        if (!data) return null;

        const sanitized = { ...data };
        
        // Remove sensitive data
        if (sanitized.media && typeof sanitized.media === 'string' && sanitized.media.length > 100) {
            sanitized.media = sanitized.media.substring(0, 100) + '... [truncated]';
        }

        return sanitized;
    }

    /**
     * Write log to file
     */
    writeLog(type, logEntry) {
        const date = new Date().toISOString().split('T')[0];
        const filename = `${type}-${date}.log`;
        const filepath = path.join(this.logDir, filename);
        
        const logLine = JSON.stringify(logEntry) + '\n';
        
        fs.appendFileSync(filepath, logLine, 'utf8');
    }

    /**
     * Get failure statistics
     */
    getFailureStats(hours = 24) {
        const stats = {
            totalFailures: 0,
            errorTypes: {},
            failuresByInstance: {},
            recentFailures: []
        };

        try {
            const date = new Date().toISOString().split('T')[0];
            const filename = `message-failures-${date}.log`;
            const filepath = path.join(this.logDir, filename);

            if (fs.existsSync(filepath)) {
                const logs = fs.readFileSync(filepath, 'utf8');
                const lines = logs.trim().split('\n').filter(line => line);
                
                const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));

                lines.forEach(line => {
                    try {
                        const entry = JSON.parse(line);
                        const entryTime = new Date(entry.timestamp);
                        
                        if (entryTime >= cutoffTime) {
                            stats.totalFailures++;
                            
                            const errorType = entry.error?.type || 'UNKNOWN';
                            stats.errorTypes[errorType] = (stats.errorTypes[errorType] || 0) + 1;
                            
                            stats.failuresByInstance[entry.instanceId] = 
                                (stats.failuresByInstance[entry.instanceId] || 0) + 1;
                            
                            if (stats.recentFailures.length < 10) {
                                stats.recentFailures.push({
                                    timestamp: entry.timestamp,
                                    instanceId: entry.instanceId,
                                    chatId: entry.chatId,
                                    error: entry.error
                                });
                            }
                        }
                    } catch (e) {
                        // Skip invalid log lines
                    }
                });
            }
        } catch (error) {
            console.error('Error reading failure stats:', error);
        }

        return stats;
    }

    /**
     * Generate failure report
     */
    generateFailureReport() {
        const stats = this.getFailureStats(24);
        
        console.log('\n📊 MESSAGE FAILURE REPORT (Last 24 hours)');
        console.log('='.repeat(50));
        console.log(`Total Failures: ${stats.totalFailures}`);
        
        if (stats.totalFailures > 0) {
            console.log('\n🔍 Error Types:');
            Object.entries(stats.errorTypes).forEach(([type, count]) => {
                console.log(`  ${type}: ${count} failures`);
            });
            
            console.log('\n📱 Failures by Instance:');
            Object.entries(stats.failuresByInstance).forEach(([instance, count]) => {
                console.log(`  ${instance}: ${count} failures`);
            });
            
            if (stats.recentFailures.length > 0) {
                console.log('\n🕐 Recent Failures:');
                stats.recentFailures.forEach((failure, index) => {
                    console.log(`  ${index + 1}. ${failure.timestamp}`);
                    console.log(`     Instance: ${failure.instanceId}`);
                    console.log(`     Chat: ${failure.chatId}`);
                    console.log(`     Error: ${failure.error?.type || 'UNKNOWN'} - ${failure.error?.description || 'No description'}`);
                    console.log(`     Solution: ${failure.error?.solution || 'No solution available'}`);
                    console.log('');
                });
            }
        } else {
            console.log('✅ No failures in the last 24 hours!');
        }
        
        console.log('='.repeat(50));
    }
}

module.exports = MessageLogger;