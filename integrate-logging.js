/**
 * Integrate Enhanced Logging System
 * Script untuk mengintegrasikan sistem logging yang lebih detail
 */

const fs = require('fs');
const path = require('path');

function integrateLogging() {
    console.log('🔧 Integrating enhanced message logging system...');
    
    // 1. Backup original waziper.js
    const waziperPath = path.join(__dirname, 'waziper', 'waziper.js');
    const backupPath = path.join(__dirname, 'waziper', 'waziper.js.backup');
    
    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(waziperPath, backupPath);
        console.log('✅ Backup created: waziper.js.backup');
    }
    
    // 2. Read current waziper.js
    let waziperContent = fs.readFileSync(waziperPath, 'utf8');
    
    // 3. Add imports at the top
    const imports = `
const MessageLogger = require("../enhanced-message-logging.js");
const MessageLoggingPatch = require("../message-logging-patch.js");
`;
    
    // Find the first require statement and add our imports after it
    const firstRequireIndex = waziperContent.indexOf('const fs = require("fs");');
    if (firstRequireIndex !== -1) {
        waziperContent = waziperContent.slice(0, firstRequireIndex) + 
                        imports + 
                        waziperContent.slice(firstRequireIndex);
    }
    
    // 4. Initialize logging system
    const initLogging = `
// Initialize enhanced logging system
const messageLogger = new MessageLogger();
const loggingPatch = new MessageLoggingPatch();
`;
    
    // Add after the sessions object declaration
    const sessionsIndex = waziperContent.indexOf('const sessions = {};');
    if (sessionsIndex !== -1) {
        const endOfLine = waziperContent.indexOf('\n', sessionsIndex);
        waziperContent = waziperContent.slice(0, endOfLine + 1) + 
                        initLogging + 
                        waziperContent.slice(endOfLine + 1);
    }
    
    // 5. Enhance auto_send function with better error handling
    const autoSendEnhancement = `
  auto_send: async function (
    instance_id,
    chat_id,
    phone_number,
    type,
    item,
    params,
    callback
  ) {
    // Log message attempt
    const attemptLog = messageLogger.logMessageAttempt(instance_id, chat_id, type, {
      messageType: item.type,
      hasMedia: !!(item.media && item.media !== ""),
      caption: item.caption ? item.caption.substring(0, 100) : null
    });

    var limit = await WAZIPER.limit(item, type);
    if (!limit) {
      const error = new Error("Message limit exceeded");
      messageLogger.logMessageFailure(instance_id, chat_id, error, {
        messageType: item.type,
        phone_number: phone_number,
        reason: "limit_exceeded"
      });
      
      return callback({
        status: 0,
        stats: false,
        message: "The number of messages you have sent per month has exceeded the maximum limit",
        error: "LIMIT_EXCEEDED"
      });
    }

    // Enhanced error handling wrapper
    const handleSendResult = (sendPromise, messageType) => {
      return sendPromise
        .then(async (message) => {
          messageLogger.logMessageSuccess(instance_id, chat_id, message.key?.id, {
            type: type,
            phone_number: phone_number,
            messageType: messageType
          });
          
          callback({
            status: 1,
            type: type,
            phone_number: phone_number,
            stats: true,
            message: message,
          });
          WAZIPER.stats(instance_id, type, item, 1);
        })
        .catch((err) => {
          // Enhanced error logging
          messageLogger.logMessageFailure(instance_id, chat_id, err, {
            messageType: messageType,
            phone_number: phone_number,
            hasMedia: !!(item.media && item.media !== "")
          });
          
          console.error(\`❌ Message send failed for \${phone_number}:\`, {
            error: err.message,
            type: messageType,
            instance: instance_id,
            timestamp: new Date().toISOString()
          });
          
          callback({
            status: 0,
            type: type,
            phone_number: phone_number,
            stats: true,
            error: err.message,
            errorType: err.name || 'SendError'
          });
          WAZIPER.stats(instance_id, type, item, 0);
        });
    };

    switch (item.type) {
      //Button
      case 2:
        var template = await WAZIPER.button_template_handler(
          item.template,
          params
        );
        if (template) {
          const sendPromise = sessions[instance_id].sendMessage(chat_id, template, {
            ephemeralExpiration: 604800,
          });
          handleSendResult(sendPromise, "button");
        }
        break;
        
      //List Messages
      case 3:
        var template = await WAZIPER.list_message_template_handler(
          item.template,
          params
        );
        if (template) {
          const sendPromise = sessions[instance_id].sendMessage(chat_id, template, {
            ephemeralExpiration: 604800,
          });
          handleSendResult(sendPromise, "list");
        }
        break;
        
      //Media & Text
      default:
        var caption = spintax.unspin(item.caption);
        caption = Common.params(params, caption);
        
        if (item.media != "" && item.media) {
          var mime = Common.ext2mime(item.media);
          var post_type = Common.post_type(mime, 1);
          var filename =
            item.filename != undefined
              ? item.filename
              : Common.get_file_name(item.media);
              
          switch (post_type) {
            case "videoMessage":
              var data = {
                video: { url: item.media },
                caption: caption,
              };
              break;

            case "imageMessage":
              var data = {
                image: { url: item.media },
                caption: caption,
              };
              break;

            case "audioMessage":
              var data = {
                audio: { url: item.media },
                caption: caption,
              };
              break;

            default:
              var data = {
                document: { url: item.media },
                fileName: filename,
                caption: caption,
              };
              break;
          }

          const sendPromise = sessions[instance_id].sendMessage(chat_id, data);
          handleSendResult(sendPromise, post_type);
        } else {
          const sendPromise = sessions[instance_id].sendMessage(chat_id, { text: caption });
          handleSendResult(sendPromise, "text");
        }
    }
  },`;
    
    // Replace the existing auto_send function
    const autoSendStart = waziperContent.indexOf('auto_send: async function (');
    if (autoSendStart !== -1) {
        // Find the end of the function (next function or closing brace)
        let braceCount = 0;
        let inFunction = false;
        let endIndex = autoSendStart;
        
        for (let i = autoSendStart; i < waziperContent.length; i++) {
            const char = waziperContent[i];
            if (char === '{') {
                braceCount++;
                inFunction = true;
            } else if (char === '}') {
                braceCount--;
                if (inFunction && braceCount === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }
        
        // Find the next comma after the closing brace
        const nextComma = waziperContent.indexOf(',', endIndex);
        if (nextComma !== -1) {
            endIndex = nextComma;
        }
        
        waziperContent = waziperContent.slice(0, autoSendStart) + 
                        autoSendEnhancement.trim() + 
                        waziperContent.slice(endIndex);
    }
    
    // 6. Add logging command at the end
    const loggingCommands = `

// Enhanced logging commands
WAZIPER.showFailureReport = function() {
  messageLogger.generateFailureReport();
};

WAZIPER.getFailureStats = function(hours = 24) {
  return messageLogger.getFailureStats(hours);
};

// Apply logging patches when server starts
setTimeout(() => {
  loggingPatch.applyPatches(WAZIPER, sessions);
  console.log('📊 Enhanced message logging system is active');
  console.log('💡 Use WAZIPER.showFailureReport() to see failure statistics');
}, 5000);
`;
    
    // Add before the final export/cron section
    const cronIndex = waziperContent.lastIndexOf('cron.schedule');
    if (cronIndex !== -1) {
        waziperContent = waziperContent.slice(0, cronIndex) + 
                        loggingCommands + 
                        '\n' + 
                        waziperContent.slice(cronIndex);
    }
    
    // 7. Write the enhanced file
    fs.writeFileSync(waziperPath, waziperContent);
    console.log('✅ Enhanced logging integrated into waziper.js');
    
    // 8. Create logging commands script
    const commandsScript = `#!/usr/bin/env node
/**
 * Logging Commands
 * Script untuk melihat statistik dan laporan error
 */

const MessageLogger = require('./enhanced-message-logging.js');

const logger = new MessageLogger();

const command = process.argv[2];

switch (command) {
    case 'report':
        logger.generateFailureReport();
        break;
        
    case 'stats':
        const hours = parseInt(process.argv[3]) || 24;
        const stats = logger.getFailureStats(hours);
        console.log(JSON.stringify(stats, null, 2));
        break;
        
    case 'watch':
        console.log('👀 Watching for message failures... (Press Ctrl+C to stop)');
        setInterval(() => {
            const stats = logger.getFailureStats(1); // Last hour
            if (stats.totalFailures > 0) {
                console.log(\`⚠️  \${stats.totalFailures} failures in the last hour\`);
                Object.entries(stats.errorTypes).forEach(([type, count]) => {
                    console.log(\`   \${type}: \${count}\`);
                });
            }
        }, 60000); // Check every minute
        break;
        
    default:
        console.log(\`
📊 Message Logging Commands

Usage:
  node logging-commands.js <command>

Commands:
  report          Show detailed failure report
  stats [hours]   Show failure statistics (default: 24 hours)
  watch           Watch for failures in real-time

Examples:
  node logging-commands.js report
  node logging-commands.js stats 12
  node logging-commands.js watch
        \`);
}
`;
    
    fs.writeFileSync(path.join(__dirname, 'logging-commands.js'), commandsScript);
    fs.chmodSync(path.join(__dirname, 'logging-commands.js'), '755');
    console.log('✅ Created logging-commands.js');
    
    console.log('\n🎉 Enhanced logging system integrated successfully!');
    console.log('\n📋 How to use:');
    console.log('1. Restart your server: ./restart-clean.sh');
    console.log('2. Check failure reports: node logging-commands.js report');
    console.log('3. Watch real-time failures: node logging-commands.js watch');
    console.log('4. View logs directory: ls -la logs/');
    
    return true;
}

if (require.main === module) {
    integrateLogging();
}

module.exports = { integrateLogging };