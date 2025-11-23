#!/usr/bin/env node

/**
 * WebSocket Health Monitor
 * Monitors connection health, circuit breaker status, and auto-recovery
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: process.env.API_URL || 'http://localhost:8000',
  checkInterval: 30000, // 30 seconds
  logFile: path.join(__dirname, '../logs/health-monitor.log'),
  alertThreshold: {
    failureRate: 0.5, // Alert jika > 50% failures
    circuitBreakerActivations: 3 // Alert jika circuit breaker activate 3x
  }
};

class HealthMonitor {
  constructor() {
    this.stats = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      circuitBreakerActivations: 0,
      lastCheck: null
    };
    
    this.instanceIds = [];
    this.alerts = [];
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    
    console.log(logMessage.trim());
    
    // Append to log file
    fs.appendFileSync(CONFIG.logFile, logMessage, 'utf8');
  }

  async loadInstances() {
    try {
      // Load instances from database or config
      // For now, we'll scan from sessions directory
      const sessionsDir = path.join(__dirname, '../sessions');
      
      if (fs.existsSync(sessionsDir)) {
        const dirs = fs.readdirSync(sessionsDir);
        this.instanceIds = dirs.filter(dir => {
          const dirPath = path.join(sessionsDir, dir);
          return fs.statSync(dirPath).isDirectory() && fs.existsSync(path.join(dirPath, 'creds.json'));
        });
        
        this.log(`Loaded ${this.instanceIds.length} instances for monitoring`);
      } else {
        this.log('Sessions directory not found', 'WARN');
      }
    } catch (error) {
      this.log(`Error loading instances: ${error.message}`, 'ERROR');
    }
  }

  async checkInstanceHealth(instanceId) {
    try {
      const response = await axios.get(
        `${CONFIG.baseUrl}/circuit-breaker-status/${instanceId}`,
        { timeout: 5000 }
      );

      if (response.data && response.data.data) {
        const data = response.data.data;
        
        // Log status
        const status = {
          instance: instanceId,
          retry_attempts: data.retry_attempts,
          recent_failures: data.recent_failures,
          circuit_breaker: data.circuit_breaker_active ? '🔴 ACTIVE' : '✅ NORMAL',
          session: data.session_exists ? '✅' : '❌',
          connecting: data.connecting ? '🔄' : '➖'
        };

        this.log(`Health Check - Instance: ${instanceId} | Retries: ${status.retry_attempts} | Failures: ${status.recent_failures} | CB: ${status.circuit_breaker} | Session: ${status.session} | Connecting: ${status.connecting}`);

        // Check for alerts
        if (data.circuit_breaker_active) {
          this.stats.circuitBreakerActivations++;
          this.alerts.push({
            type: 'CIRCUIT_BREAKER',
            instance: instanceId,
            timestamp: new Date(),
            data: data
          });
          this.log(`🚨 ALERT: Circuit breaker active for ${instanceId}`, 'ALERT');
        }

        // Check failure rate
        if (data.recent_failures > 5 && !data.circuit_breaker_active) {
          this.alerts.push({
            type: 'HIGH_FAILURE_RATE',
            instance: instanceId,
            timestamp: new Date(),
            failures: data.recent_failures
          });
          this.log(`⚠️ WARNING: High failure rate for ${instanceId} (${data.recent_failures} failures)`, 'WARN');
        }

        this.stats.successfulChecks++;
        return { success: true, data };
      }
    } catch (error) {
      this.log(`Failed to check health for ${instanceId}: ${error.message}`, 'ERROR');
      this.stats.failedChecks++;
      return { success: false, error: error.message };
    }
  }

  async checkAllInstances() {
    this.log('=== Starting Health Check Cycle ===');
    this.stats.totalChecks++;
    this.stats.lastCheck = new Date();

    if (this.instanceIds.length === 0) {
      await this.loadInstances();
    }

    const results = [];
    for (const instanceId of this.instanceIds) {
      const result = await this.checkInstanceHealth(instanceId);
      results.push({ instanceId, ...result });
      
      // Small delay between checks
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.generateReport(results);
    this.log('=== Health Check Cycle Complete ===\n');
  }

  generateReport(results) {
    const summary = {
      total: results.length,
      healthy: results.filter(r => r.success && r.data && !r.data.circuit_breaker_active).length,
      unhealthy: results.filter(r => !r.success || (r.data && r.data.circuit_breaker_active)).length,
      connecting: results.filter(r => r.success && r.data && r.data.connecting).length
    };

    this.log('--- Health Check Summary ---');
    this.log(`Total Instances: ${summary.total}`);
    this.log(`Healthy: ${summary.healthy} (${(summary.healthy / summary.total * 100).toFixed(1)}%)`);
    this.log(`Unhealthy: ${summary.unhealthy}`);
    this.log(`Connecting: ${summary.connecting}`);
    this.log('---------------------------');

    // Overall stats
    const failureRate = this.stats.failedChecks / this.stats.totalChecks;
    if (failureRate > CONFIG.alertThreshold.failureRate) {
      this.log(`🚨 CRITICAL: High overall failure rate: ${(failureRate * 100).toFixed(1)}%`, 'CRITICAL');
    }

    if (this.stats.circuitBreakerActivations >= CONFIG.alertThreshold.circuitBreakerActivations) {
      this.log(`🚨 CRITICAL: Circuit breaker activated ${this.stats.circuitBreakerActivations} times`, 'CRITICAL');
    }
  }

  async start() {
    this.log('🚀 WebSocket Health Monitor Started');
    this.log(`Base URL: ${CONFIG.baseUrl}`);
    this.log(`Check Interval: ${CONFIG.checkInterval}ms`);
    this.log(`Log File: ${CONFIG.logFile}`);
    
    // Initial check
    await this.checkAllInstances();

    // Schedule periodic checks
    this.interval = setInterval(async () => {
      await this.checkAllInstances();
    }, CONFIG.checkInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.stop();
    });

    process.on('SIGTERM', () => {
      this.stop();
    });
  }

  stop() {
    this.log('🛑 Stopping Health Monitor...');
    
    if (this.interval) {
      clearInterval(this.interval);
    }

    // Final report
    this.log('=== Final Statistics ===');
    this.log(`Total Checks: ${this.stats.totalChecks}`);
    this.log(`Successful: ${this.stats.successfulChecks}`);
    this.log(`Failed: ${this.stats.failedChecks}`);
    this.log(`Circuit Breaker Activations: ${this.stats.circuitBreakerActivations}`);
    this.log(`Alerts: ${this.alerts.length}`);
    this.log('=======================');

    process.exit(0);
  }
}

// Start monitor
const monitor = new HealthMonitor();
monitor.start().catch(error => {
  console.error('Failed to start monitor:', error);
  process.exit(1);
});
