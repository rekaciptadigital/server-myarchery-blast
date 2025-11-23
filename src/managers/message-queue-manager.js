/**
 * 📨 Message Queue Manager
 * Advanced message queueing system untuk memastikan high success rate
 */

class MessageQueueManager {
    constructor() {
        this.queues = {}; // Per instance queue
        this.retryQueues = {}; // Retry queue per instance
        this.processingQueues = {}; // Currently processing messages
        this.stats = {};
        
        // Configuration
        this.config = {
            maxRetries: 3,
            retryDelay: 5000, // 5 seconds
            maxQueueSize: 100,
            processingTimeout: 30000, // 30 seconds
            batchSize: 1, // Process one by one for stability
        };
        
        console.log("📨 Message Queue Manager initialized");
        this.startQueueProcessor();
    }
    
    /**
     * Add message to queue
     */
    addMessage(instanceId, messageData) {
        if (!this.queues[instanceId]) {
            this.initializeInstanceQueue(instanceId);
        }
        
        const message = {
            id: this.generateMessageId(),
            instanceId: instanceId,
            data: messageData,
            attempts: 0,
            createdAt: Date.now(),
            status: 'queued'
        };
        
        // Check queue size limit
        if (this.queues[instanceId].length >= this.config.maxQueueSize) {
            console.log(`⚠️ Queue full for instance ${instanceId}, rejecting message`);
            return { success: false, reason: 'queue_full', messageId: message.id };
        }
        
        this.queues[instanceId].push(message);
        this.updateStats(instanceId, 'queued');
        
        console.log(`📥 Message queued for ${instanceId}: ${message.id}`);
        return { success: true, messageId: message.id };
    }
    
    /**
     * Process message queue for specific instance
     */
    async processInstanceQueue(instanceId, sessions, WAZIPER) {
        if (!this.queues[instanceId] || this.queues[instanceId].length === 0) {
            return;
        }
        
        // Check if instance is ready
        const session = sessions[instanceId];
        if (!session || !session.ws || session.ws.readyState !== 1) {
            console.log(`⏳ Session not ready for ${instanceId}, skipping queue processing`);
            return;
        }
        
        // Prevent concurrent processing
        if (this.processingQueues[instanceId]) {
            return;
        }
        
        this.processingQueues[instanceId] = true;
        
        try {
            // Process one message at a time for stability
            const message = this.queues[instanceId].shift();
            if (!message) {
                this.processingQueues[instanceId] = false;
                return;
            }
            
            console.log(`🚀 Processing message ${message.id} for ${instanceId}`);
            message.status = 'processing';
            message.attempts++;
            
            // Set processing timeout
            const timeoutId = setTimeout(() => {
                console.log(`⏰ Message ${message.id} timeout, moving to retry`);
                this.moveToRetryQueue(message);
            }, this.config.processingTimeout);
            
            // Attempt to send message
            const result = await this.sendMessage(message, WAZIPER);
            clearTimeout(timeoutId);
            
            if (result.success) {
                console.log(`✅ Message ${message.id} sent successfully`);
                message.status = 'sent';
                this.updateStats(instanceId, 'success');
            } else {
                console.log(`❌ Message ${message.id} failed: ${result.error}`);
                this.handleFailedMessage(message, result.error);
            }
            
        } catch (error) {
            console.log(`💥 Error processing queue for ${instanceId}:`, error.message);
        } finally {
            this.processingQueues[instanceId] = false;
        }
    }
    
    /**
     * Send individual message
     */
    async sendMessage(message, WAZIPER) {
        return new Promise((resolve) => {
            const { instanceId, data } = message;
            const { chat_id, type, item, params } = data;
            
            WAZIPER.auto_send(
                instanceId,
                chat_id,
                chat_id,
                type || "api",
                item,
                params || false,
                (result) => {
                    if (result && result.status === 1) {
                        resolve({ success: true, result });
                    } else {
                        resolve({ 
                            success: false, 
                            error: result?.error || result?.message || 'Unknown error',
                            result 
                        });
                    }
                }
            );
        });
    }
    
    /**
     * Handle failed message
     */
    handleFailedMessage(message, error) {
        if (message.attempts < this.config.maxRetries) {
            console.log(`🔄 Retrying message ${message.id} (attempt ${message.attempts}/${this.config.maxRetries})`);
            this.moveToRetryQueue(message);
        } else {
            console.log(`💀 Message ${message.id} permanently failed after ${message.attempts} attempts`);
            message.status = 'failed';
            this.updateStats(message.instanceId, 'failed');
        }
    }
    
    /**
     * Move message to retry queue
     */
    moveToRetryQueue(message) {
        if (!this.retryQueues[message.instanceId]) {
            this.retryQueues[message.instanceId] = [];
        }
        
        message.status = 'retry';
        message.retryAt = Date.now() + this.config.retryDelay;
        this.retryQueues[message.instanceId].push(message);
        this.updateStats(message.instanceId, 'retry');
    }
    
    /**
     * Process retry queue
     */
    processRetryQueue(instanceId) {
        if (!this.retryQueues[instanceId]) {
            return;
        }
        
        const now = Date.now();
        const readyToRetry = this.retryQueues[instanceId].filter(msg => msg.retryAt <= now);
        
        readyToRetry.forEach(message => {
            // Move back to main queue
            message.status = 'queued';
            this.queues[instanceId].unshift(message); // Add to front for priority
            
            // Remove from retry queue
            const index = this.retryQueues[instanceId].indexOf(message);
            this.retryQueues[instanceId].splice(index, 1);
            
            console.log(`🔄 Message ${message.id} moved from retry to main queue`);
        });
    }
    
    /**
     * Initialize queue for instance
     */
    initializeInstanceQueue(instanceId) {
        this.queues[instanceId] = [];
        this.retryQueues[instanceId] = [];
        this.stats[instanceId] = {
            queued: 0,
            success: 0,
            failed: 0,
            retry: 0
        };
    }
    
    /**
     * Update statistics
     */
    updateStats(instanceId, type) {
        if (!this.stats[instanceId]) {
            this.initializeInstanceQueue(instanceId);
        }
        this.stats[instanceId][type]++;
    }
    
    /**
     * Generate unique message ID
     */
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Start queue processor
     */
    startQueueProcessor() {
        // Process main queues every 2 seconds
        setInterval(() => {
            Object.keys(this.queues).forEach(instanceId => {
                this.processRetryQueue(instanceId);
            });
        }, 2000);
        
        console.log("🔄 Queue processor started");
    }
    
    /**
     * Get queue status
     */
    getQueueStatus(instanceId) {
        if (!instanceId) {
            // Return all instances status
            const status = {};
            Object.keys(this.queues).forEach(id => {
                status[id] = this.getQueueStatus(id);
            });
            return status;
        }
        
        return {
            instanceId,
            mainQueue: this.queues[instanceId]?.length || 0,
            retryQueue: this.retryQueues[instanceId]?.length || 0,
            processing: this.processingQueues[instanceId] || false,
            stats: this.stats[instanceId] || { queued: 0, success: 0, failed: 0, retry: 0 }
        };
    }
    
    /**
     * Get success rate
     */
    getSuccessRate(instanceId) {
        const stats = this.stats[instanceId];
        if (!stats) return 0;
        
        const total = stats.success + stats.failed;
        if (total === 0) return 0;
        
        return Math.round((stats.success / total) * 100);
    }
    
    /**
     * Clear all queues for instance
     */
    clearInstanceQueues(instanceId) {
        if (this.queues[instanceId]) {
            this.queues[instanceId] = [];
        }
        if (this.retryQueues[instanceId]) {
            this.retryQueues[instanceId] = [];
        }
        this.processingQueues[instanceId] = false;
        console.log(`🧹 Cleared all queues for instance ${instanceId}`);
    }
}

module.exports = MessageQueueManager;
