const mysql = require('mysql2');
const config = require('./config.js');

console.log('Testing database connection...');
console.log('Config:', config.database);

const db_connect = mysql.createConnection(config.database);

db_connect.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Database connected successfully!');
    
    // Test query
    db_connect.query('SHOW TABLES', (err, results) => {
        if (err) {
            console.error('Query failed:', err);
        } else {
            console.log('Tables found:', results.length);
            results.forEach(table => {
                console.log('- ' + Object.values(table)[0]);
            });
        }
        
        // Test sp_whatsapp_sessions table
        db_connect.query('SELECT * FROM sp_whatsapp_sessions ORDER BY id DESC LIMIT 5', (err, results) => {
            if (err) {
                console.error('sp_whatsapp_sessions query failed:', err);
            } else {
                console.log('\nRecent WhatsApp sessions:');
                console.log(results);
            }
            
            // Test sp_team table
            db_connect.query('SELECT * FROM sp_team LIMIT 5', (err, results) => {
                if (err) {
                    console.error('sp_team query failed:', err);
                } else {
                    console.log('\nTeam data:');
                    console.log(results);
                }
                
                db_connect.end();
            });
        });
    });
});