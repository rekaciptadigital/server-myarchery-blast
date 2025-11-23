#!/usr/bin/env node

/**
 * 🔍 QR CODE GENERATION TEST
 * Testing apakah perbaikan conflict prevention mempengaruhi QR generation
 * 
 * Author: The Debug Beast Agent
 * Date: 2025-08-15
 */

const axios = require('axios');
const config = require('./config.js');

console.log('🧪 QR Generation Test - Checking Impact of Conflict Prevention');
console.log('======================================================');

class QRGenerationTester {
    constructor() {
        this.baseUrl = `http://localhost:${config.port || 8000}`;
        this.testInstanceId = 'QR_TEST_' + Date.now();
        this.accessToken = 'test_token_123'; // Test token
        this.results = {
            qrGenerationTime: null,
            qrGenerationSuccess: false,
            sessionCreationTime: null,
            conflictPreventionImpact: null,
            errors: []
        };
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async testQRGeneration() {
        console.log('\n📱 Testing QR Code Generation Process...');
        
        try {
            const startTime = Date.now();
            
            // Step 1: Request QR code generation
            console.log(`🔄 Requesting QR code for instance: ${this.testInstanceId}`);
            
            const qrResponse = await axios.get(
                `${this.baseUrl}/get_qrcode/${this.testInstanceId}?access_token=${this.accessToken}`,
                { timeout: 70000 } // 70 second timeout
            );
            
            const generationTime = Date.now() - startTime;
            this.results.qrGenerationTime = generationTime;
            
            console.log(`⏱️  QR Generation completed in: ${generationTime}ms`);
            console.log(`📊 Response status: ${qrResponse.data.status}`);
            
            if (qrResponse.data.status === 'success') {
                this.results.qrGenerationSuccess = true;
                console.log('✅ QR Code generated successfully!');
                console.log(`📏 Base64 length: ${qrResponse.data.base64?.length || 'N/A'}`);
                
                // Validate QR code format
                if (qrResponse.data.base64 && qrResponse.data.base64.startsWith('data:image/png;base64,')) {
                    console.log('✅ QR Code format is valid');
                } else {
                    console.log('⚠️  QR Code format may be invalid');
                    this.results.errors.push('Invalid QR code format');
                }
            } else {
                console.log('❌ QR Generation failed:', qrResponse.data.message);
                this.results.errors.push(`QR Generation failed: ${qrResponse.data.message}`);
            }
            
            return qrResponse.data;
            
        } catch (error) {
            console.log('❌ QR Generation error:', error.message);
            this.results.errors.push(`QR Generation error: ${error.message}`);
            return null;
        }
    }

    async testConflictPreventionImpact() {
        console.log('\n🛡️  Testing Conflict Prevention Impact on QR Generation...');
        
        try {
            // Test multiple QR requests to see if conflict prevention interferes
            const promises = [];
            const testCount = 3;
            
            console.log(`🔄 Making ${testCount} simultaneous QR requests to test conflict prevention...`);
            
            for (let i = 0; i < testCount; i++) {
                const testId = `QR_CONFLICT_TEST_${Date.now()}_${i}`;
                promises.push(this.makeQRRequest(testId));
            }
            
            const results = await Promise.allSettled(promises);
            
            let successCount = 0;
            let conflictCount = 0;
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    if (result.value?.status === 'success') {
                        successCount++;
                        console.log(`✅ Request ${index + 1}: Success`);
                    } else {
                        console.log(`⚠️  Request ${index + 1}: ${result.value?.message || 'Failed'}`);
                    }
                } else {
                    conflictCount++;
                    console.log(`❌ Request ${index + 1}: ${result.reason?.message || 'Error'}`);
                }
            });
            
            console.log(`📊 Results: ${successCount}/${testCount} successful, ${conflictCount} conflicts`);
            
            // Analyze impact
            if (conflictCount === 0) {
                this.results.conflictPreventionImpact = 'No interference detected';
                console.log('✅ Conflict prevention does not interfere with QR generation');
            } else if (conflictCount < testCount) {
                this.results.conflictPreventionImpact = 'Minimal interference detected';
                console.log('⚠️  Some interference detected, but not blocking all requests');
            } else {
                this.results.conflictPreventionImpact = 'Significant interference detected';
                console.log('❌ Conflict prevention may be blocking QR generation');
            }
            
        } catch (error) {
            console.log('❌ Conflict prevention test error:', error.message);
            this.results.errors.push(`Conflict prevention test error: ${error.message}`);
        }
    }

    async makeQRRequest(instanceId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/get_qrcode/${instanceId}?access_token=${this.accessToken}`,
                { timeout: 30000 }
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async testSessionConflictScenario() {
        console.log('\n🔀 Testing Session Conflict Scenario...');
        
        try {
            const conflictTestId = `CONFLICT_TEST_${Date.now()}`;
            
            // Step 1: Create a session
            console.log('🔄 Creating initial session...');
            const session1 = await this.makeQRRequest(conflictTestId);
            
            await this.delay(2000);
            
            // Step 2: Try to create another session with same ID (potential conflict)
            console.log('🔄 Creating duplicate session (conflict test)...');
            const session2 = await this.makeQRRequest(conflictTestId);
            
            // Analyze results
            if (session1?.status === 'success' && session2?.status === 'success') {
                console.log('⚠️  Both sessions created - potential conflict not prevented');
                this.results.errors.push('Potential conflict not prevented');
            } else if (session1?.status === 'success' && session2?.status !== 'success') {
                console.log('✅ Second session blocked - conflict prevention working');
            } else {
                console.log('🤔 Unexpected results in conflict test');
            }
            
        } catch (error) {
            console.log('❌ Session conflict test error:', error.message);
            this.results.errors.push(`Session conflict test error: ${error.message}`);
        }
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test sessions...');
        
        try {
            // Try to logout test sessions
            const cleanupInstances = [
                this.testInstanceId,
                `QR_CONFLICT_TEST_${Date.now()}_0`,
                `QR_CONFLICT_TEST_${Date.now()}_1`,
                `QR_CONFLICT_TEST_${Date.now()}_2`,
                `CONFLICT_TEST_${Date.now()}`
            ];
            
            for (const instanceId of cleanupInstances) {
                try {
                    await axios.delete(
                        `${this.baseUrl}/logout/${instanceId}?access_token=${this.accessToken}`,
                        { timeout: 5000 }
                    );
                } catch (cleanupError) {
                    // Ignore cleanup errors
                }
            }
            
            console.log('✅ Cleanup completed');
            
        } catch (error) {
            console.log('⚠️  Cleanup error (non-critical):', error.message);
        }
    }

    printResults() {
        console.log('\n📋 TEST RESULTS SUMMARY');
        console.log('========================');
        
        console.log(`🕐 QR Generation Time: ${this.results.qrGenerationTime || 'N/A'}ms`);
        console.log(`✅ QR Generation Success: ${this.results.qrGenerationSuccess ? 'YES' : 'NO'}`);
        console.log(`🛡️  Conflict Prevention Impact: ${this.results.conflictPreventionImpact || 'Not tested'}`);
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ ERRORS DETECTED:');
            this.results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        } else {
            console.log('\n✅ NO ERRORS DETECTED');
        }
        
        // Overall assessment
        console.log('\n🏆 OVERALL ASSESSMENT:');
        if (this.results.qrGenerationSuccess && this.results.errors.length === 0) {
            console.log('✅ QR Generation is working perfectly with conflict prevention');
            console.log('✅ No negative impact detected from conflict prevention improvements');
        } else if (this.results.qrGenerationSuccess && this.results.errors.length <= 2) {
            console.log('⚠️  QR Generation is working with minor issues');
            console.log('⚠️  Minimal impact from conflict prevention improvements');
        } else {
            console.log('❌ QR Generation has significant issues');
            console.log('❌ Conflict prevention may be interfering with QR generation');
        }
    }

    async runAllTests() {
        console.log('🚀 Starting comprehensive QR generation testing...\n');
        
        try {
            // Test 1: Basic QR Generation
            await this.testQRGeneration();
            
            await this.delay(3000);
            
            // Test 2: Conflict Prevention Impact
            await this.testConflictPreventionImpact();
            
            await this.delay(3000);
            
            // Test 3: Session Conflict Scenario
            await this.testSessionConflictScenario();
            
            // Cleanup
            await this.cleanup();
            
            // Print results
            this.printResults();
            
        } catch (error) {
            console.log('❌ Test execution error:', error.message);
            this.results.errors.push(`Test execution error: ${error.message}`);
            this.printResults();
        }
    }
}

// Check if server is running
async function checkServerStatus() {
    try {
        const response = await axios.get('http://localhost:8000/health', { timeout: 5000 });
        return true;
    } catch (error) {
        return false;
    }
}

// Main execution
async function main() {
    console.log('🔍 Checking server status...');
    
    const serverRunning = await checkServerStatus();
    if (!serverRunning) {
        console.log('❌ Server is not running on port 8000');
        console.log('💡 Please start the server with: node app.js');
        process.exit(1);
    }
    
    console.log('✅ Server is running');
    
    const tester = new QRGenerationTester();
    await tester.runAllTests();
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = QRGenerationTester;
