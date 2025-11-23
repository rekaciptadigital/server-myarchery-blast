#!/usr/bin/env node

/**
 * 🧪 Message Success Rate Tester
 * Tool untuk testing dan monitoring success rate pengiriman pesan
 */

const axios = require('axios');

class MessageSuccessRateTester {
    constructor(baseUrl = 'http://localhost:8000', accessToken = 'test_token') {
        this.baseUrl = baseUrl;
        this.accessToken = accessToken;
        this.testResults = {
            total: 0,
            success: 0,
            failed: 0,
            queued: 0,
            errors: []
        };
        
        console.log("🧪 Message Success Rate Tester initialized");
        console.log(`📡 Base URL: ${baseUrl}`);
        console.log("=" .repeat(60));
    }
    
    /**
     * Send test message
     */
    async sendTestMessage(instanceId, chatId, caption, delay = 1000) {
        try {
            const response = await axios.post(`${this.baseUrl}/send-message/${instanceId}?access_token=${this.accessToken}`, {
                chat_id: chatId,
                caption: caption
            });
            
            return {
                success: response.data.status === 'success',
                data: response.data,
                queued: response.data.message?.queued || false
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message,
                data: error.response?.data
            };
        }
    }
    
    /**
     * Run batch test
     */
    async runBatchTest(instanceId, chatId, messageCount = 5, interval = 2000) {
        console.log(`🚀 Starting batch test: ${messageCount} messages`);
        console.log(`📱 Instance: ${instanceId}`);
        console.log(`💬 Chat: ${chatId}`);
        console.log(`⏱️  Interval: ${interval}ms\n`);
        
        this.testResults = {
            total: 0,
            success: 0,
            failed: 0,
            queued: 0,
            errors: [],
            startTime: Date.now()
        };
        
        for (let i = 1; i <= messageCount; i++) {
            const caption = `🧪 Test Message #${i} - ${new Date().toISOString()}`;
            
            console.log(`📤 Sending message ${i}/${messageCount}...`);
            
            const result = await this.sendTestMessage(instanceId, chatId, caption);
            this.testResults.total++;
            
            if (result.success) {
                if (result.queued) {
                    this.testResults.queued++;
                    console.log(`🟡 Message ${i}: QUEUED`);
                } else {
                    this.testResults.success++;
                    console.log(`✅ Message ${i}: SUCCESS`);
                }
            } else {
                this.testResults.failed++;
                this.testResults.errors.push({
                    messageNumber: i,
                    error: result.error,
                    timestamp: new Date().toISOString()
                });
                console.log(`❌ Message ${i}: FAILED - ${result.error}`);
            }
            
            // Wait before next message
            if (i < messageCount) {
                await this.sleep(interval);
            }
        }
        
        this.testResults.endTime = Date.now();
        this.testResults.duration = this.testResults.endTime - this.testResults.startTime;
        
        return this.generateReport();
    }
    
    /**
     * Monitor queue status during test
     */
    async monitorQueueStatus(instanceId, duration = 60000) {
        console.log(`📊 Monitoring queue status for ${duration/1000} seconds...\n`);
        
        const startTime = Date.now();
        const statusHistory = [];
        
        while (Date.now() - startTime < duration) {
            try {
                const response = await axios.get(`${this.baseUrl}/queue-status/${instanceId}?access_token=${this.accessToken}`);
                
                if (response.data.status === 'success') {
                    const status = response.data.data;
                    statusHistory.push({
                        timestamp: new Date().toISOString(),
                        ...status
                    });
                    
                    console.log(`📊 Queue: Main(${status.mainQueue}) Retry(${status.retryQueue}) Success: ${status.successRate}%`);
                    
                    if (status.recommendations) {
                        status.recommendations.forEach(rec => {
                            console.log(`   ${rec}`);
                        });
                    }
                }
                
            } catch (error) {
                console.log(`⚠️ Error monitoring queue: ${error.message}`);
            }
            
            await this.sleep(5000); // Check every 5 seconds
        }
        
        return statusHistory;
    }
    
    /**
     * Run comprehensive test
     */
    async runComprehensiveTest(instanceId, chatId, options = {}) {
        const {
            messageCount = 5,
            interval = 2000,
            monitorDuration = 30000
        } = options;
        
        console.log("🎯 COMPREHENSIVE MESSAGE SUCCESS RATE TEST");
        console.log("=" .repeat(60));
        
        // Start monitoring in background
        const monitorPromise = this.monitorQueueStatus(instanceId, monitorDuration);
        
        // Wait a bit before starting messages
        await this.sleep(2000);
        
        // Run batch test
        const testReport = await this.runBatchTest(instanceId, chatId, messageCount, interval);
        
        // Wait for monitoring to complete
        const queueHistory = await monitorPromise;
        
        // Generate comprehensive report
        return {
            testReport,
            queueHistory,
            recommendations: this.generateRecommendations(testReport, queueHistory)
        };
    }
    
    /**
     * Generate test report
     */
    generateReport() {
        const successRate = this.testResults.total > 0 ? 
            Math.round(((this.testResults.success + this.testResults.queued) / this.testResults.total) * 100) : 0;
        const immediateSuccessRate = this.testResults.total > 0 ? 
            Math.round((this.testResults.success / this.testResults.total) * 100) : 0;
        
        console.log("\n" + "=" .repeat(60));
        console.log("📊 TEST RESULTS SUMMARY");
        console.log("=" .repeat(60));
        console.log(`📈 Total Messages: ${this.testResults.total}`);
        console.log(`✅ Immediate Success: ${this.testResults.success} (${immediateSuccessRate}%)`);
        console.log(`🟡 Queued: ${this.testResults.queued}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`🎯 Overall Success Rate: ${successRate}%`);
        console.log(`⏱️  Test Duration: ${this.testResults.duration}ms`);
        
        // Success rate evaluation
        console.log("\n🔍 EVALUATION:");
        if (successRate >= 90) {
            console.log("🟢 EXCELLENT - System performing very well");
        } else if (successRate >= 80) {
            console.log("🟡 GOOD - System performing well with minor issues");
        } else if (successRate >= 60) {
            console.log("🟠 FAIR - System has noticeable issues");
        } else {
            console.log("🔴 POOR - System needs immediate attention");
        }
        
        // Error details
        if (this.testResults.errors.length > 0) {
            console.log("\n❌ ERROR DETAILS:");
            this.testResults.errors.forEach(error => {
                console.log(`   Message ${error.messageNumber}: ${error.error}`);
            });
        }
        
        console.log("=" .repeat(60) + "\n");
        
        return {
            ...this.testResults,
            successRate,
            immediateSuccessRate
        };
    }
    
    /**
     * Generate recommendations
     */
    generateRecommendations(testReport, queueHistory) {
        const recommendations = [];
        
        if (testReport.successRate < 80) {
            recommendations.push("🔧 Consider reducing message sending frequency");
            recommendations.push("🔄 Implement exponential backoff for retries");
        }
        
        if (testReport.queued > testReport.success) {
            recommendations.push("📬 High queue usage - consider optimizing connection stability");
        }
        
        if (testReport.failed > 1) {
            recommendations.push("⚠️ Multiple failures detected - check session health");
        }
        
        const avgQueueSize = queueHistory.reduce((sum, status) => sum + status.mainQueue, 0) / queueHistory.length;
        if (avgQueueSize > 5) {
            recommendations.push("📊 High average queue size - consider increasing processing speed");
        }
        
        return recommendations;
    }
    
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// CLI Usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log("Usage: node message-success-rate-tester.js <instance_id> <chat_id> [message_count] [interval_ms]");
        console.log("Example: node message-success-rate-tester.js 6880714A02801 6281234567890@s.whatsapp.net 5 2000");
        process.exit(1);
    }
    
    const [instanceId, chatId, messageCount = 5, interval = 2000] = args;
    
    const tester = new MessageSuccessRateTester();
    
    tester.runComprehensiveTest(instanceId, chatId, {
        messageCount: parseInt(messageCount),
        interval: parseInt(interval),
        monitorDuration: 60000
    }).then(result => {
        console.log("🎉 Test completed successfully!");
        
        if (result.recommendations.length > 0) {
            console.log("\n💡 RECOMMENDATIONS:");
            result.recommendations.forEach(rec => {
                console.log(`   ${rec}`);
            });
        }
        
        process.exit(0);
    }).catch(error => {
        console.error("💥 Test failed:", error.message);
        process.exit(1);
    });
}

module.exports = MessageSuccessRateTester;
