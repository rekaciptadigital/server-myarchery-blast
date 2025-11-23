#!/usr/bin/env node
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
                console.log(`⚠️  ${stats.totalFailures} failures in the last hour`);
                Object.entries(stats.errorTypes).forEach(([type, count]) => {
                    console.log(`   ${type}: ${count}`);
                });
            }
        }, 60000); // Check every minute
        break;
        
    default:
        console.log(`
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
        `);
}
