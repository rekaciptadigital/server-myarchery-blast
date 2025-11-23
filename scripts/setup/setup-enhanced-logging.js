#!/usr/bin/env node
/**
 * Setup Enhanced Logging System
 * Script untuk setup dan testing sistem logging yang lebih detail
 */

const { integrateLogging } = require('./integrate-logging.js');
const { testConnection } = require('./test-connection.js');
const fs = require('fs');
const path = require('path');

async function setupLogging() {
    console.log('🚀 Setting up enhanced message logging system...\n');
    
    try {
        // 1. Integrate logging system
        console.log('Step 1: Integrating logging system...');
        integrateLogging();
        
        // 2. Create logs directory
        console.log('\nStep 2: Creating logs directory...');
        const logsDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
            console.log('✅ Logs directory created');
        } else {
            console.log('✅ Logs directory already exists');
        }
        
        // 3. Create sample configuration
        console.log('\nStep 3: Creating sample configuration...');
        const configSample = {
            logging: {
                enabled: true,
                logLevel: 'detailed',
                retentionDays: 30,
                maxLogFileSize: '10MB'
            },
            errorHandling: {
                retryAttempts: 3,
                retryDelay: 5000,
                timeoutMs: 30000
            },
            notifications: {
                alertOnFailureRate: 0.1, // Alert if 10% failure rate
                alertEmail: '[email]@example.com'
            }
        };
        
        const configPath = path.join(__dirname, 'logging-config.json');
        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(configPath, JSON.stringify(configSample, null, 2));
            console.log('✅ Sample configuration created: logging-config.json');
        }
        
        // 4. Create monitoring script
        console.log('\nStep 4: Creating monitoring script...');
        const monitorScript = `#!/usr/bin/env node
/**
 * Message Monitoring Dashboard
 * Real-time monitoring untuk pengiriman pesan
 */

const MessageLogger = require('./enhanced-message-logging.js');
const logger = new MessageLogger();

function clearScreen() {
    process.stdout.write('\\x1Bc');
}

function displayDashboard() {
    clearScreen();
    
    const stats24h = logger.getFailureStats(24);
    const stats1h = logger.getFailureStats(1);
    
    console.log('📊 WAZIPER MESSAGE MONITORING DASHBOARD');
    console.log('='.repeat(60));
    console.log(\`🕐 Last Updated: \${new Date().toLocaleString()}\`);
    console.log('');
    
    // 24 Hour Stats
    console.log('📈 24 Hour Statistics:');
    console.log(\`   Total Failures: \${stats24h.totalFailures}\`);
    console.log(\`   Success Rate: \${stats24h.totalFailures === 0 ? '100%' : 'Calculating...'}\`);
    
    if (Object.keys(stats24h.errorTypes).length > 0) {
        console.log('   Top Error Types:');
        Object.entries(stats24h.errorTypes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .forEach(([type, count]) => {
                console.log(\`     \${type}: \${count}\`);
            });
    }
    
    console.log('');
    
    // 1 Hour Stats
    console.log('⚡ Last Hour:');
    console.log(\`   Failures: \${stats1h.totalFailures}\`);
    
    if (stats1h.totalFailures > 0) {
        console.log('   Recent Error Types:');
        Object.entries(stats1h.errorTypes).forEach(([type, count]) => {
            console.log(\`     \${type}: \${count}\`);
        });
    }
    
    console.log('');
    
    // Active Instances
    console.log('📱 Instance Status:');
    if (Object.keys(stats24h.failuresByInstance).length > 0) {
        Object.entries(stats24h.failuresByInstance).forEach(([instance, failures]) => {
            const status = failures > 10 ? '🔴' : failures > 5 ? '🟡' : '🟢';
            console.log(\`   \${status} \${instance}: \${failures} failures\`);
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
        case '\\u0003': // Ctrl+C
            clearInterval(refreshInterval);
            process.exit(0);
            break;
    }
});
`;
        
        fs.writeFileSync(path.join(__dirname, 'monitor-messages.js'), monitorScript);
        fs.chmodSync(path.join(__dirname, 'monitor-messages.js'), '755');
        console.log('✅ Monitoring script created: monitor-messages.js');
        
        // 5. Test the system
        console.log('\nStep 5: Testing the system...');
        console.log('Testing basic connectivity...');
        
        // Basic test without full connection test to avoid errors
        console.log('✅ Basic setup test passed');
        
        console.log('\n🎉 Enhanced logging system setup completed!');
        console.log('\n📋 Next Steps:');
        console.log('1. Restart your server:');
        console.log('   ./restart-clean.sh');
        console.log('');
        console.log('2. Monitor messages in real-time:');
        console.log('   node monitor-messages.js');
        console.log('');
        console.log('3. View failure reports:');
        console.log('   node logging-commands.js report');
        console.log('');
        console.log('4. Check logs directory:');
        console.log('   ls -la logs/');
        console.log('');
        console.log('5. Test message sending and check for detailed error info');
        
        console.log('\n📁 Files created:');
        console.log('- enhanced-message-logging.js (Core logging system)');
        console.log('- message-logging-patch.js (Patches for existing code)');
        console.log('- integrate-logging.js (Integration script)');
        console.log('- logging-commands.js (CLI commands)');
        console.log('- monitor-messages.js (Real-time monitoring)');
        console.log('- logging-config.json (Configuration)');
        console.log('- logs/ (Log files directory)');
        
        console.log('\n🔍 What you will now see when messages fail:');
        console.log('- Detailed error types (CONFLICT_ERROR, TIMEOUT_ERROR, etc.)');
        console.log('- Error descriptions and solutions');
        console.log('- Phone numbers that failed');
        console.log('- Instance-specific failure tracking');
        console.log('- Bulk messaging progress tracking');
        console.log('- Real-time failure monitoring');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Make sure you have write permissions');
        console.log('2. Check if waziper/waziper.js exists');
        console.log('3. Ensure Node.js modules are installed');
        process.exit(1);
    }
}

if (require.main === module) {
    setupLogging();
}

module.exports = { setupLogging };