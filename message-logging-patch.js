/**
 * Message Logging Patch
 * Patch untuk menambahkan enhanced logging ke sistem WAZIPER
 */

const MessageLogger = require('./enhanced-message-logging.js');

class MessageLoggingPatch {
    constructor() {
        this.logger = new MessageLogger();
    }

    /**
     * Patch fungsi auto_send untuk menambahkan logging
     */
    patchAutoSend(WAZIPER) {
        const originalAutoSend = WAZIPER.auto_send;
        
        WAZIPER.auto_send = async function(instance_id, chat_id, phone_number, type, item, params, callback) {
            const logger = new MessageLogger();
            
            // Log attempt
            const attemptLog = logger.logMessageAttempt(instance_id, chat_id, type, {
                messageType: item.type,
                hasMedia: !!(item.media && item.media !== ""),
                caption: item.caption ? item.caption.substring(0, 100) : null
            });

            // Wrap callback untuk logging
            const wrappedCallback = function(result) {
                if (result.status === 1) {
                    // Success
                    logger.logMessageSuccess(instance_id, chat_id, result.message?.key?.id, {
                        type: type,
                        phone_number: phone_number,
                        messageType: item.type
                    });
                } else {
                    // Failure - log dengan detail error
                    logger.logMessageFailure(instance_id, chat_id, {
                        message: `Message sending failed for type: ${type}`,
                        name: 'MessageSendError'
                    }, {
                        messageType: item.type,
                        hasMedia: !!(item.media && item.media !== ""),
                        phone_number: phone_number
                    });
                }
                
                // Call original callback
                callback(result);
            };

            // Call original function dengan wrapped callback
            return originalAutoSend.call(this, instance_id, chat_id, phone_number, type, item, params, wrappedCallback);
        };
    }

    /**
     * Patch fungsi sendMessage untuk menambahkan error handling yang lebih detail
     */
    patchSendMessage(sessions) {
        Object.keys(sessions).forEach(instance_id => {
            const session = sessions[instance_id];
            if (session && session.sendMessage) {
                const originalSendMessage = session.sendMessage;
                const logger = new MessageLogger();
                
                session.sendMessage = async function(chatId, message, options = {}) {
                    try {
                        const result = await originalSendMessage.call(this, chatId, message, options);
                        return result;
                    } catch (error) {
                        // Log detailed error
                        logger.logMessageFailure(instance_id, chatId, error, {
                            messageType: this.getMessageType(message),
                            hasMedia: this.hasMedia(message),
                            options: options
                        });
                        
                        // Re-throw error untuk handling normal
                        throw error;
                    }
                };
                
                // Helper methods
                session.getMessageType = function(message) {
                    if (message.text) return 'text';
                    if (message.image) return 'image';
                    if (message.video) return 'video';
                    if (message.audio) return 'audio';
                    if (message.document) return 'document';
                    if (message.buttonsMessage) return 'buttons';
                    if (message.listMessage) return 'list';
                    return 'unknown';
                };
                
                session.hasMedia = function(message) {
                    return !!(message.image || message.video || message.audio || message.document);
                };
            }
        });
    }

    /**
     * Patch bulk messaging untuk logging progress
     */
    patchBulkMessaging(WAZIPER) {
        const originalBulkMessaging = WAZIPER.bulk_messaging;
        
        WAZIPER.bulk_messaging = async function() {
            const logger = new MessageLogger();
            
            try {
                await originalBulkMessaging.call(this);
            } catch (error) {
                logger.logMessageFailure('bulk_system', 'bulk_messaging', error, {
                    function: 'bulk_messaging',
                    timestamp: new Date().toISOString()
                });
                console.error('Bulk messaging error:', error);
            }
        };
    }

    /**
     * Enhanced error handler untuk connection issues
     */
    enhanceConnectionErrorHandling(WAZIPER) {
        const logger = new MessageLogger();
        
        // Override makeWASocket untuk menambahkan error logging
        const originalMakeWASocket = WAZIPER.makeWASocket;
        
        WAZIPER.makeWASocket = async function(instance_id) {
            const WA = await originalMakeWASocket.call(this, instance_id);
            
            // Add enhanced error handling
            WA.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;
                
                if (lastDisconnect?.error) {
                    const error = lastDisconnect.error;
                    logger.logMessageFailure(instance_id, 'connection', error, {
                        connectionState: connection,
                        statusCode: error.output?.statusCode,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Log specific error types
                    if (error.message?.includes('Stream Errored (conflict)')) {
                        console.log(`🔴 CONFLICT ERROR detected for instance ${instance_id}`);
                        console.log('   Possible causes:');
                        console.log('   - Multiple WhatsApp sessions on same number');
                        console.log('   - Session not properly closed');
                        console.log('   - Network connectivity issues');
                    }
                }
            });
            
            return WA;
        };
    }

    /**
     * Apply all patches
     */
    applyPatches(WAZIPER, sessions) {
        console.log('🔧 Applying message logging patches...');
        
        this.patchAutoSend(WAZIPER);
        this.patchBulkMessaging(WAZIPER);
        this.enhanceConnectionErrorHandling(WAZIPER);
        
        // Patch existing sessions
        this.patchSendMessage(sessions);
        
        // Set up periodic session patching for new sessions
        setInterval(() => {
            this.patchSendMessage(sessions);
        }, 30000); // Check every 30 seconds
        
        console.log('✅ Message logging patches applied successfully');
    }

    /**
     * Generate and display failure report
     */
    showFailureReport() {
        this.logger.generateFailureReport();
    }
}

module.exports = MessageLoggingPatch;