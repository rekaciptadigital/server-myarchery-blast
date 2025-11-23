/**
 * WhatsApp Connection Conflict Fix
 * 
 * This script helps resolve "Stream Errored (conflict)" issues by:
 * 1. Cleaning up duplicate sessions
 * 2. Removing stale session files
 * 3. Resetting connection states
 */

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

class ConnectionFixer {
    constructor() {
        this.sessionDir = path.join(__dirname, 'sessions');
    }

    // Clean up all session files
    cleanAllSessions() {
        console.log('🧹 Cleaning all session files...');
        
        if (fs.existsSync(this.sessionDir)) {
            const sessions = fs.readdirSync(this.sessionDir);
            
            sessions.forEach(sessionId => {
                const sessionPath = path.join(this.sessionDir, sessionId);
                if (fs.statSync(sessionPath).isDirectory()) {
                    console.log(`Removing session: ${sessionId}`);
                    rimraf.sync(sessionPath);
                }
            });
            
            console.log('✅ All sessions cleaned');
        } else {
            console.log('📁 Sessions directory not found');
        }
    }

    // Clean specific session
    cleanSession(instanceId) {
        console.log(`🧹 Cleaning session for instance: ${instanceId}`);
        
        const sessionPath = path.join(this.sessionDir, instanceId);
        if (fs.existsSync(sessionPath)) {
            rimraf.sync(sessionPath);
            console.log(`✅ Session ${instanceId} cleaned`);
        } else {
            console.log(`📁 Session ${instanceId} not found`);
        }
    }

    // List all active sessions
    listSessions() {
        console.log('📋 Listing all sessions...');
        
        if (fs.existsSync(this.sessionDir)) {
            const sessions = fs.readdirSync(this.sessionDir);
            
            if (sessions.length === 0) {
                console.log('📭 No sessions found');
                return [];
            }
            
            sessions.forEach(sessionId => {
                const sessionPath = path.join(this.sessionDir, sessionId);
                if (fs.statSync(sessionPath).isDirectory()) {
                    const files = fs.readdirSync(sessionPath);
                    console.log(`📂 ${sessionId} (${files.length} files)`);
                }
            });
            
            return sessions;
        } else {
            console.log('📁 Sessions directory not found');
            return [];
        }
    }

    // Check for potential conflicts
    checkConflicts() {
        console.log('🔍 Checking for potential conflicts...');
        
        const sessions = this.listSessions();
        const conflicts = [];
        
        sessions.forEach(sessionId => {
            const sessionPath = path.join(this.sessionDir, sessionId);
            const credsPath = path.join(sessionPath, 'creds.json');
            
            if (fs.existsSync(credsPath)) {
                try {
                    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                    if (!creds.me || !creds.me.id) {
                        conflicts.push({
                            sessionId,
                            issue: 'Invalid credentials'
                        });
                    }
                } catch (error) {
                    conflicts.push({
                        sessionId,
                        issue: 'Corrupted credentials file'
                    });
                }
            } else {
                conflicts.push({
                    sessionId,
                    issue: 'Missing credentials file'
                });
            }
        });
        
        if (conflicts.length > 0) {
            console.log('⚠️  Found potential conflicts:');
            conflicts.forEach(conflict => {
                console.log(`   - ${conflict.sessionId}: ${conflict.issue}`);
            });
        } else {
            console.log('✅ No conflicts detected');
        }
        
        return conflicts;
    }

    // Fix detected conflicts
    fixConflicts() {
        console.log('🔧 Fixing detected conflicts...');
        
        const conflicts = this.checkConflicts();
        
        conflicts.forEach(conflict => {
            console.log(`Fixing ${conflict.sessionId}: ${conflict.issue}`);
            this.cleanSession(conflict.sessionId);
        });
        
        console.log('✅ Conflicts fixed');
    }
}

// CLI interface
if (require.main === module) {
    const fixer = new ConnectionFixer();
    const command = process.argv[2];
    const instanceId = process.argv[3];
    
    switch (command) {
        case 'clean-all':
            fixer.cleanAllSessions();
            break;
            
        case 'clean':
            if (!instanceId) {
                console.log('❌ Please provide instance ID: node fix-connection-conflicts.js clean <instance_id>');
                process.exit(1);
            }
            fixer.cleanSession(instanceId);
            break;
            
        case 'list':
            fixer.listSessions();
            break;
            
        case 'check':
            fixer.checkConflicts();
            break;
            
        case 'fix':
            fixer.fixConflicts();
            break;
            
        default:
            console.log(`
🔧 WhatsApp Connection Conflict Fixer

Usage:
  node fix-connection-conflicts.js <command> [options]

Commands:
  clean-all           Clean all session files
  clean <instance_id> Clean specific session
  list               List all sessions
  check              Check for conflicts
  fix                Fix detected conflicts

Examples:
  node fix-connection-conflicts.js clean-all
  node fix-connection-conflicts.js clean 6880714A02801
  node fix-connection-conflicts.js check
  node fix-connection-conflicts.js fix
            `);
    }
}

module.exports = ConnectionFixer;