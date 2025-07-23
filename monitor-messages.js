#!/usr/bin/env node
/**
 * Message Monitoring Dashboard
 * Real-time monitoring untuk pengiriman pesan
 */

const MessageLogger = require('./enhanced-message-logging.js');
const logger = new MessageLogger();

function clearScreen() {
    process.stdout.write('\x1Bc');
}

function displayDashboard() {
    clearScreen();
    
    const stats24h = logger.getFailureStats(24);
    const stats1h = logger.getFailureStats(1);
    
    console.log('📊 WAZIPER MESSAGE MONITORING DASHBOARD');
    console.log('='.repeat(60));
    console.log(`🕐 Last Updated: ${new Date().toLocaleString()}`);
    console.log('');
    
    // 24 Hour Stats
    console.log('📈 24 Hour Statistics:');
    console.log(`   Total Failures: ${stats24h.totalFailures}`);
    console.log(`   Success Rate: ${stats24h.totalFailures === 0 ? '100%' : 'Calculating...'}`);
    
    if (Object.keys(stats24h.errorTypes).length > 0) {
        console.log('   Top Error Types:');
        Object.entries(stats24h.errorTypes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .forEach(([type, count]) => {
                console.log(`     ${type}: ${count}`);
            });
    }
    
    console.log('');
    
    // 1 Hour Stats
    console.log('⚡ Last Hour:');
    console.log(`   Failures: ${stats1h.totalFailures}`);
    
    if (stats1h.totalFailures > 0) {
        console.log('   Recent Error Types:');
        Object.entries(stats1h.errorTypes).forEach(([type, count]) => {
            console.log(`     ${type}: ${count}`);
        });
    }
    
    console.log('');
    
    // Active Instances
    console.log('📱 Instance Status:');
    if (Object.keys(stats24h.failuresByInstance).length > 0) {
        Object.entries(stats24h.failuresByInstance).forEach(([instance, failures]) => {
            const status = failures > 10 ? '🔴' : failures > 5 ? '🟡' : '🟢';
            console.log(`   ${status} ${instance}: ${failures} failures`);
        });
    } else {
        console.log('   🟢 All instances healthy');
    }
    
    console.log('');
    console.log('💡 Commands: [R]efresh | [Q]uit | [F]ull Report');
    console.log('='.repeat(60));
}

// Start monitoring
console.log('🚀 Starting WAZIPER Message Monitor...');
console.log('Press Ctrl+C to exit');

displayDashboard();

// Auto refresh every 30 seconds
const refreshInterval = setInterval(displayDashboard, 30000);

// Handle keyboard input
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', (key) => {
    const keyStr = key.toString().toLowerCase();
    
    switch (keyStr) {
        case 'r':
            displayDashboard();
            break;
        case 'f':
            logger.generateFailureReport();
            setTimeout(displayDashboard, 3000);
            break;
        case 'q':
        case '\u0003': // Ctrl+C
            clearInterval(refreshInterval);
            process.exit(0);
            break;
    }
});
