var config = {
	debug: false,
	database: {
	    connectionLimit: 500,
	    host: "127.0.0.1",
	    user: "root",
	    password: "",
	    database: "blast",
	    charset : "utf8mb4",
	    debug: false,
	    waitForConnections: true,
	    multipleStatements: true,
	    insecureAuth: true,
	    supportBigNumbers: true,
	    bigNumberStrings: true
	},
	cors: {
		origin: '*',
 		optionsSuccessStatus: 200
	}
}

module.exports = config; 