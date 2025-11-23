const WAZIPER = require("./waziper/waziper.js");

WAZIPER.app.get('/instance', WAZIPER.cors, async (req, res) => {
    var access_token = req.query.access_token;
    var instance_id = req.query.instance_id;

    await WAZIPER.instance(access_token, instance_id, false, res, async (client) => {
        await WAZIPER.get_info(instance_id, res);
    });
});

WAZIPER.app.get('/get_qrcode', WAZIPER.cors, async (req, res) => {
    var access_token = req.query.access_token;
    var instance_id = req.query.instance_id;

    await WAZIPER.instance(access_token, instance_id, true, res, async (client) => {
        await WAZIPER.get_qrcode(instance_id, res);
    });
});

WAZIPER.app.get('/get_groups', WAZIPER.cors, async (req, res) => {
    var access_token = req.query.access_token;
    var instance_id = req.query.instance_id;

    await WAZIPER.instance(access_token, instance_id, false, res, async (client) => {
        await WAZIPER.get_groups(instance_id, res);
    });
});

WAZIPER.app.get('/logout', WAZIPER.cors, async (req, res) => {
    var access_token = req.query.access_token;
    var instance_id = req.query.instance_id;
    WAZIPER.logout(instance_id, res);
});

WAZIPER.app.post('/send_message', WAZIPER.cors, async (req, res) => {
    var access_token = req.query.access_token;
    var instance_id = req.query.instance_id;

    await WAZIPER.instance(access_token, instance_id, false, res, async (client) => {
        WAZIPER.send_message(instance_id, access_token, req, res);
    });
});

// PERBAIKAN: Tambahkan route untuk monitoring queue status
WAZIPER.app.get('/queue-status/:instance_id', WAZIPER.cors, async (req, res) => {
    var access_token = req.query.access_token;
    var instance_id = req.params.instance_id;
    
    await WAZIPER.instance(access_token, instance_id, false, res, async (client) => {
        await WAZIPER.get_queue_status(instance_id, res);
    });
});

// Route untuk send message dengan path parameter (compatibility)
WAZIPER.app.post('/send-message/:instance_id', WAZIPER.cors, async (req, res) => {
    var access_token = req.query.access_token;
    var instance_id = req.params.instance_id;

    await WAZIPER.instance(access_token, instance_id, false, res, async (client) => {
        WAZIPER.send_message(instance_id, access_token, req, res);
    });
});

// NEW: Circuit Breaker Status Endpoint (No Auth - untuk monitoring)
WAZIPER.app.get('/circuit-breaker-status/:instance_id', WAZIPER.cors, async (req, res) => {
    const instance_id = req.params.instance_id;
    
    // Access internal state dari WAZIPER
    const status = WAZIPER.getCircuitBreakerStatus(instance_id);
    
    return res.json({
        status: 'success',
        data: status
    });
});

// NEW: Force Retry Endpoint (dengan auth)
WAZIPER.app.post('/force-retry/:instance_id', WAZIPER.cors, async (req, res) => {
    const access_token = req.query.access_token;
    const instance_id = req.params.instance_id;
    
    if (!access_token) {
        return res.json({
            status: 'error',
            message: 'Access token required'
        });
    }
    
    try {
        const result = await WAZIPER.forceRetry(instance_id);
        return res.json({
            status: 'success',
            message: 'Retry triggered',
            data: result
        });
    } catch (error) {
        return res.json({
            status: 'error',
            message: error.message
        });
    }
});

// NEW: Reset Circuit Breaker (Public - untuk emergency recovery)
WAZIPER.app.post('/reset-circuit-breaker/:instance_id', WAZIPER.cors, async (req, res) => {
    const instance_id = req.params.instance_id;
    
    try {
        WAZIPER.resetCircuitBreaker(instance_id);
        
        // Also clear connecting sessions
        delete WAZIPER.connecting_sessions?.[instance_id];
        
        return res.json({
            status: 'success',
            message: 'Circuit breaker reset successfully for instance: ' + instance_id,
            instance_id: instance_id
        });
    } catch (error) {
        return res.json({
            status: 'error',
            message: error.message
        });
    }
});

// NEW: Health Check Endpoint
WAZIPER.app.get('/health', WAZIPER.cors, async (req, res) => {
    const health = WAZIPER.getHealthStatus();
    
    return res.json({
        status: 'success',
        message: 'Server is running',
        data: health,
        timestamp: new Date().toISOString()
    });
});

WAZIPER.app.get('/', WAZIPER.cors, async (req, res) => {
    return res.json({ status: 'success', message: "Welcome to WAZIPER" });
});

WAZIPER.server.listen(8000, () => {
    console.log("WAZIPER IS LIVE");
});