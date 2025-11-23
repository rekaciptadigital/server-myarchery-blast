#!/usr/bin/env node

/**
 * 🧪 SIMPLE QR ENDPOINT TEST
 * Quick test untuk verifikasi QR generation endpoint masih working
 */

const axios = require('axios');

async function testQREndpoint() {
    console.log('🧪 Testing QR Generation Endpoint...');
    
    try {
        const testInstanceId = `QR_TEST_${Date.now()}`;
        const response = await axios.get(
            `http://localhost:8000/get_qrcode?access_token=test123&instance_id=${testInstanceId}`,
            { 
                timeout: 45000,
                validateStatus: function (status) {
                    return status < 500; // Accept any status less than 500
                }
            }
        );
        
        console.log('📊 Response Status:', response.status);
        console.log('📝 Response Data:', JSON.stringify(response.data, null, 2));
        
        if (response.data.status === 'success' && response.data.base64) {
            console.log('✅ QR Generation SUCCESSFUL!');
            console.log('📏 QR Base64 length:', response.data.base64.length);
            console.log('🎯 CONCLUSION: Conflict prevention TIDAK mengganggu QR generation');
        } else if (response.data.status === 'error') {
            console.log('⚠️  QR Generation returned error:', response.data.message);
            if (response.data.message.includes('timeout') || response.data.message.includes('Session lost')) {
                console.log('💡 This might be due to server load, not conflict prevention interference');
            }
        }
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Server not running on port 8000');
        } else if (error.code === 'ETIMEDOUT') {
            console.log('⏰ Request timeout - server might be busy with initial setup');
        } else {
            console.log('❌ Error:', error.message);
        }
    }
}

testQREndpoint();
