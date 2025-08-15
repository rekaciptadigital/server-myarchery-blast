#!/usr/bin/env node

/**
 * 🛡️ Conflict Prevention Monitor
 * Real-time monitoring untuk detect dan prevent conflict patterns
 */

const fs = require('fs');

class ConflictPreventionMonitor {
    constructor() {
        this.conflictHistory = {};
        this.sessionStates = {};
        this.preventionMetrics = {
            totalConflicts: 0,
            preventedAttempts: 0,
            connectionThrottles: 0,
            circuitBreakerActivations: 0
        };
        
        console.log("🛡️ Conflict Prevention Monitor Started");
        console.log("=" .repeat(60));
        this.startMonitoring();
    }
    
    /**
     * Parse log untuk detect conflict patterns
     */
    parseLogLine(line) {
        const timestamp = new Date().toISOString();
        
        // Detect conflict occurrences
        if (line.includes('Conflict error detected') || line.includes('Stream Errored (conflict)')) {
            this.recordConflict(line, timestamp);
        }
        
        // Detect prevention measures
        if (line.includes('Conflict prevention: Skipping check')) {
            this.preventionMetrics.preventedAttempts++;
            console.log(`🛡️ [${timestamp}] CONFLICT PREVENTED - Throttling worked`);
        }
        
        if (line.includes('Recent conflict detected, aborting')) {
            this.preventionMetrics.preventedAttempts++;
            console.log(`🚨 [${timestamp}] CONFLICT PREVENTED - Recent conflict history`);
        }
        
        if (line.includes('Circuit breaker activated')) {
            this.preventionMetrics.circuitBreakerActivations++;
            console.log(`⚡ [${timestamp}] CIRCUIT BREAKER ACTIVATED`);
        }
        
        if (line.includes('throttled for stability')) {
            this.preventionMetrics.connectionThrottles++;
            console.log(`⏳ [${timestamp}] CONNECTION THROTTLED`);
        }
        
        // Session health indicators
        if (line.includes('Session already healthy')) {
            this.recordHealthySession(line, timestamp);
        }
        
        // Connection attempts
        if (line.includes('Creating new WhatsApp socket')) {
            this.recordConnectionAttempt(line, timestamp);
        }
    }
    
    /**
     * Record conflict occurrence
     */
    recordConflict(line, timestamp) {
        this.preventionMetrics.totalConflicts++;
        
        // Extract instance ID if possible
        const instanceMatch = line.match(/instance[:\s]+([A-F0-9]+)/i);
        const instanceId = instanceMatch ? instanceMatch[1] : 'unknown';
        
        if (!this.conflictHistory[instanceId]) {
            this.conflictHistory[instanceId] = [];
        }
        
        this.conflictHistory[instanceId].push({
            timestamp,
            rawLine: line
        });
        
        console.log(`🚨 [${timestamp}] CONFLICT DETECTED for ${instanceId}`);
        this.analyzeConflictPattern(instanceId);
    }
    
    /**
     * Analyze conflict patterns
     */
    analyzeConflictPattern(instanceId) {
        const history = this.conflictHistory[instanceId];
        if (!history || history.length < 2) return;
        
        // Check for rapid conflicts (within 5 minutes)
        const recent = history.slice(-3); // Last 3 conflicts
        const timeSpan = new Date(recent[recent.length - 1].timestamp) - new Date(recent[0].timestamp);
        
        if (timeSpan < 300000) { // 5 minutes
            console.log(`⚠️ RAPID CONFLICT PATTERN detected for ${instanceId}`);
            console.log(`   ${recent.length} conflicts in ${Math.round(timeSpan/1000)}s`);
            this.generateRecommendations(instanceId, 'rapid_conflicts');
        }
    }
    
    /**
     * Record healthy session
     */
    recordHealthySession(line, timestamp) {
        const instanceMatch = line.match(/instance[:\s]+([A-F0-9]+)/i);
        const instanceId = instanceMatch ? instanceMatch[1] : 'unknown';
        
        if (!this.sessionStates[instanceId]) {
            this.sessionStates[instanceId] = { healthyPeriods: 0, lastHealthy: null };
        }
        
        this.sessionStates[instanceId].healthyPeriods++;
        this.sessionStates[instanceId].lastHealthy = timestamp;
        
        console.log(`💚 [${timestamp}] HEALTHY SESSION: ${instanceId}`);
    }
    
    /**
     * Record connection attempt
     */
    recordConnectionAttempt(line, timestamp) {
        const instanceMatch = line.match(/instance[:\s]+([A-F0-9]+)/i);
        const instanceId = instanceMatch ? instanceMatch[1] : 'unknown';
        
        console.log(`🔧 [${timestamp}] CONNECTION ATTEMPT: ${instanceId}`);
    }
    
    /**
     * Generate recommendations based on patterns
     */
    generateRecommendations(instanceId, pattern) {
        console.log(`\n💡 RECOMMENDATIONS for ${instanceId}:`);
        
        switch (pattern) {
            case 'rapid_conflicts':
                console.log("   1. 🛑 STOP all connection attempts for this instance");
                console.log("   2. ⏳ Extend throttling period to 5+ minutes");
                console.log("   3. 🔄 Consider manual session reset");
                console.log("   4. 📱 Check if device is being used elsewhere");
                break;
        }
        console.log("");
    }
    
    /**
     * Generate prevention report
     */
    generatePreventionReport() {
        const runtime = Date.now() - this.startTime;
        const runtimeMinutes = Math.round(runtime / 60000);
        
        console.log("\n" + "=" .repeat(60));
        console.log("🛡️ CONFLICT PREVENTION REPORT");
        console.log("=" .repeat(60));
        console.log(`⏱️  Runtime: ${runtimeMinutes} minutes`);
        console.log(`🚨 Total Conflicts: ${this.preventionMetrics.totalConflicts}`);
        console.log(`🛡️ Prevented Attempts: ${this.preventionMetrics.preventedAttempts}`);
        console.log(`⏳ Connection Throttles: ${this.preventionMetrics.connectionThrottles}`);
        console.log(`⚡ Circuit Breaker Activations: ${this.preventionMetrics.circuitBreakerActivations}`);
        
        // Calculate prevention effectiveness
        const totalAttempts = this.preventionMetrics.totalConflicts + this.preventionMetrics.preventedAttempts;
        const preventionRate = totalAttempts > 0 ? 
            Math.round((this.preventionMetrics.preventedAttempts / totalAttempts) * 100) : 0;
        
        console.log(`📊 Prevention Rate: ${preventionRate}%`);
        
        // Evaluation
        console.log("\n🔍 EVALUATION:");
        if (this.preventionMetrics.totalConflicts === 0) {
            console.log("🟢 EXCELLENT - No conflicts detected");
        } else if (preventionRate >= 80) {
            console.log("🟡 GOOD - Most conflicts prevented");
        } else if (preventionRate >= 50) {
            console.log("🟠 FAIR - Some conflicts still occurring");
        } else {
            console.log("🔴 POOR - Prevention measures need improvement");
        }
        
        // Instance-specific analysis
        console.log("\n📱 PER-INSTANCE ANALYSIS:");
        Object.keys(this.conflictHistory).forEach(instanceId => {
            const conflicts = this.conflictHistory[instanceId].length;
            const healthy = this.sessionStates[instanceId]?.healthyPeriods || 0;
            console.log(`   ${instanceId}: ${conflicts} conflicts, ${healthy} healthy periods`);
        });
        
        console.log("=" .repeat(60) + "\n");
    }
    
    /**
     * Start monitoring
     */
    startMonitoring() {
        this.startTime = Date.now();
        
        // Generate report every 5 minutes
        setInterval(() => {
            this.generatePreventionReport();
        }, 300000);
        
        // Listen to stdin for log parsing
        console.log("🎯 Monitoring conflict prevention. Paste log lines below:");
        console.log("   Example: node app.js 2>&1 | node conflict-prevention-monitor.js");
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
    
    /**
     * Summary statistics
     */
    getSummaryStats() {
        return {
            conflictsPrevented: this.preventionMetrics.preventedAttempts,
            conflictsOccurred: this.preventionMetrics.totalConflicts,
            preventionMechanisms: {
                throttling: this.preventionMetrics.connectionThrottles,
                circuitBreaker: this.preventionMetrics.circuitBreakerActivations
            },
            instanceAnalysis: Object.keys(this.conflictHistory).map(instanceId => ({
                instanceId,
                conflicts: this.conflictHistory[instanceId].length,
                healthyPeriods: this.sessionStates[instanceId]?.healthyPeriods || 0
            }))
        };
    }
}

// Check if script is being run directly
if (require.main === module) {
    const monitor = new ConflictPreventionMonitor();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log("\n🛡️ Conflict Prevention Monitor stopping...");
        monitor.generatePreventionReport();
        
        const stats = monitor.getSummaryStats();
        console.log("\n📈 FINAL STATISTICS:");
        console.log(JSON.stringify(stats, null, 2));
        
        process.exit(0);
    });
}

module.exports = ConflictPreventionMonitor;
