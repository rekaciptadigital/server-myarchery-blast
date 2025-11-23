/**
 * Test WhatsApp Connection
 * Script untuk test apakah fix conflict sudah bekerja
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

// Test data - ganti dengan data yang valid
const TEST_DATA = {
    access_token: 'test_token', // Ganti dengan token yang valid dari database
    instance_id: '6880714A02801'
};

async function testConnection() {
    console.log('🧪 Testing WhatsApp API Connection...\n');
    
    try {
        // Test 1: Basic API health check
        console.log('1️⃣ Testing API health...');
        const healthResponse = await axios.get(`${BASE_URL}/`);
        console.log('✅ API Health:', healthResponse.data);
        
        // Test 2: Get instance info (will show if connection works)
        console.log('\n2️⃣ Testing instance connection...');
        try {
            const instanceResponse = await axios.get(`${BASE_URL}/instance`, {
                params: {
                    access_token: TEST_DATA.access_token,
                    instance_id: TEST_DATA.instance_id
                },
                timeout: 10000
            });
            console.log('✅ Instance Response:', instanceResponse.data);
        } catch (error) {
            if (error.response) {
                console.log('⚠️ Instance Response:', error.response.data);
                
                // If auth failed, that's expected without valid token
                if (error.response.data.message?.includes('authentication')) {
                    console.log('ℹ️ Authentication failed - this is expected without valid token');
                }
            } else {
                console.log('❌ Instance Error:', error.message);
            }
        }
        
        // Test 3: Check if server is handling requests without conflicts
        console.log('\n3️⃣ Testing multiple concurrent requests...');
        const promises = [];
        
        for (let i = 0; i < 5; i++) {
            promises.push(
                axios.get(`${BASE_URL}/`, { timeout: 5000 })
                    .then(() => ({ success: true, index: i }))
                    .catch(error => ({ success: false, index: i, error: error.message }))
            );
        }
        
        const results = await Promise.all(promises);
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`✅ Concurrent requests: ${successful} successful, ${failed} failed`);
        
        if (failed > 0) {
            console.log('❌ Failed requests:');
            results.filter(r => !r.success).forEach(r => {
                console.log(`   Request ${r.index}: ${r.error}`);
            });
        }
        
        console.log('\n📊 Test Summary:');
        console.log(`- API Health: ✅ Working`);
        console.log(`- Concurrent Handling: ${failed === 0 ? '✅' : '⚠️'} ${successful}/${results.length} successful`);
        console.log(`- Server Stability: ${failed === 0 ? '✅ Stable' : '⚠️ Some issues detected'}`);
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        console.log('\n🔍 Troubleshooting:');
        console.log('1. Make sure server is running: ./restart-clean.sh');
        console.log('2. Check server logs: tail -f server.log');
        console.log('3. Verify port 8000 is not blocked');
    }
}

async function monitorLogs() {
    console.log('\n📋 Recent server logs:');
    console.log('='.repeat(50));
    
    const { spawn } = require('child_process');
    const tail = spawn('tail', ['-20', 'server.log']);
    
    tail.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    
    tail.stderr.on('data', (data) => {
        console.log('Log error:', data.toString());
    });
    
    tail.on('close', (code) => {
        console.log('='.repeat(50));
    });
    
    // Wait for logs to display
    await new Promise(resolve => setTimeout(resolve, 1000));
}

async function checkForConflicts() {
    console.log('\n🔍 Checking for conflict patterns in logs...');
    
    const fs = require('fs');
    const path = require('path');
    
    try {
        const logPath = path.join(__dirname, 'server.log');
        if (fs.existsSync(logPath)) {
            const logs = fs.readFileSync(logPath, 'utf8');
            const lines = logs.split('\n');
            
            const conflictPatterns = [
                'Stream Errored (conflict)',
                'Connection closed, reason: Error: Stream Errored (conflict)',
                'Conflict error detected',
                'Error: Timed Out'
            ];
            
            let conflictsFound = 0;
            
            conflictPatterns.forEach(pattern => {
                const matches = lines.filter(line => line.includes(pattern));
                if (matches.length > 0) {
                    console.log(`⚠️ Found ${matches.length} instances of: "${pattern}"`);
                    conflictsFound += matches.length;
                }
            });
            
            if (conflictsFound === 0) {
                console.log('✅ No conflict patterns found in logs');
            } else {
                console.log(`❌ Total conflicts found: ${conflictsFound}`);
                console.log('\n💡 Recommendations:');
                console.log('1. Run: node fix-connection-conflicts.js fix');
                console.log('2. Restart server: ./restart-clean.sh --clean-sessions');
                console.log('3. Check for multiple WhatsApp logins on same number');
            }
        } else {
            console.log('📁 No server.log file found');
        }
    } catch (error) {
        console.log('❌ Error reading logs:', error.message);
    }
}

// Main execution
async function main() {
    const command = process.argv[2];
    
    switch (command) {
        case 'test':
            await testConnection();
            break;
            
        case 'logs':
            await monitorLogs();
            break;
            
        case 'conflicts':
            await checkForConflicts();
            break;
            
        case 'full':
            await testConnection();
            await monitorLogs();
            await checkForConflicts();
            break;
            
        default:
            console.log(`
🧪 WhatsApp API Connection Tester

Usage:
  node test-connection.js <command>

Commands:
  test      Test API connection and stability
  logs      Show recent server logs
  conflicts Check for conflict patterns in logs
  full      Run all tests

Examples:
  node test-connection.js test
  node test-connection.js conflicts
  node test-connection.js full
            `);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testConnection, monitorLogs, checkForConflicts };