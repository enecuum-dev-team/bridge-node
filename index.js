let argv = require('yargs').argv;
let Node = require('./validator.js');
let fs = require('fs');

const CONFIG_FILENAME = 'config.json';
let config = {
	"port" : 8080,
	"loglevel" : "silly",
	"networks" : []
};

console.silly = function (...msg) {console.log(`\x1b[35m%s\x1b[0m`, ...msg);};
console.trace = function (...msg) {console.log(`\x1b[36m\x1b[1m%s\x1b[0m`, ...msg);};
console.debug = function (...msg) {console.log(`\x1b[37m%s\x1b[0m`, ...msg);};
console.info = function (...msg) {console.log(`\x1b[37m\x1b[1m%s\x1b[0m`, ...msg);};
console.warn = function (...msg) {console.log(`\x1b[33m%s\x1b[0m`, ...msg);};
console.error = function (...msg) {console.log(`\x1b[31m\x1b[1m%s\x1b[0m`, ...msg);};
console.fatal = function (...msg) {
	console.log(`\x1b[31m%s\x1b[0m`, ...msg);
	process.exit(1);
};

require('console-stamp')(console, {datePrefix: '[', pattern:'yyyy.mm.dd HH:MM:ss', level: config.loglevel, extend:{fatal:0, debug:4, trace:5, silly:6}, include:['silly', 'trace','debug','info','warn','error','fatal']});

console.info("Application started");

let config_filename = argv.config || CONFIG_FILENAME;

console.info('Loading config from', config_filename, '...');

let cfg = {};
try {
	let content = fs.readFileSync(config_filename, 'utf8');
	cfg = JSON.parse(content);
	config = Object.assign(config, cfg);
} catch (e) {
	console.info(`Failed to read config from file - ${JSON.stringify(e)}`);
}

config = Object.assign(config, argv);

console.info(`config = ${JSON.stringify(config)}`);

let node = new Node(config);
node.start();