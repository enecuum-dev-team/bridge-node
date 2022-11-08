let express = require('express');
let cors = require('cors');
let crypto = require('crypto');
let fs = require('fs');

let argv = require('yargs').argv;

const CONFIG_FILENAME = 'config.json';
let config = {
	"port" : 1111,
	"loglevel" : "silly",
	"network_id" : 17,
	tx_confirmation_delay : 10,
};

console.trace = function (...msg) {
	console.log(...msg);
};

console.debug = function (...msg) {
	console.log(...msg);
};

console.silly = function (...msg) {
	console.log(...msg);
};

console.fatal = function (...msg) {
	console.log(...msg);
	process.exit(1);
};

require('console-stamp')(console, {datePrefix: '[', pattern:'yyyy.mm.dd HH:MM:ss', level: config.loglevel, extend:{fatal:0, debug:4, trace:5, silly:6}, include:['silly', 'trace','debug','info','warn','error','fatal']});

console.info("Application started");

let config_filename = argv.config || CONFIG_FILENAME;

console.info('Loading config from', config_filename, '...');

let cfg = {};
try {
	cfg = JSON.parse(fs.readFileSync(config_filename, 'utf8'));
	config = Object.assign(config, cfg);
} catch (e) {
	console.info('No configuration file found')
}

config = Object.assign(config, argv);

console.info(`config = ${JSON.stringify(config)}`);

let minted = [];
let locks = [];
let tokens = [];
let ledger = [];

try {
	tokens = JSON.parse(fs.readFileSync(config.tokens_filename, 'utf8'));
} catch(e){
	console.info('Token list is empty')
}

console.info(`tokens = ${JSON.stringify(tokens)}`);

let app = express();
app.use(cors());
app.use(express.json());

let validate_signature = function(signature, key){
	if (signature.split('.')[1] === key){
		return true;
	} else {
		return false;
	}
}

let random_hash = function(){
	return crypto.randomBytes(Math.ceil(64/2)).toString('hex').slice(0,64);
}

let create_token = function(address, ticker, amount){
	let hash = random_hash();
	tokens.push({hash, ticker});
	ledger.push({address, hash, amount});
}

app.post('/api/v1/lock', async (req, res) => {
	console.trace('on lock', req.body);
	try {
		let {dst_address, dst_network, amount, src_hash, src_address} = req.body;

		let tx_hash = random_hash();

		setTimeout(function(){
			locks[tx_hash] = {dst_address, dst_network, amount, src_hash, src_address};
		}, config.tx_confirmation_delay);

		res.send({err:0, result:{hash:tx_hash}});
	} catch(e){
		res.send({err:1, error:e.toString()});
	}
});

app.post('/api/v1/claim', async (req, res) => {
	console.trace('on claim', req.body);
	try {
		let {dst_address, dst_network, amount, src_hash, src_address, ticker, src_network, origin_hash, origin_network, nonce} = req.body.ticket;

		create_token(dst_address, ticker, amount);

		res.send({err:0, result:{hash:random_hash()}});
	} catch(e){
		res.send({err:1, error:e.toString()});
	}
});

app.get('/api/v1/network_id', async (req, res) => {
	console.trace('on network_id', req.body);
	res.send({network_id:config.network_id});
});

app.get('/api/v1/transfers', async (req, res) => {
	console.trace('on transfers', req.query);
	res.send({});
});

app.get('/api/v1/read_lock', async (req, res) => {
	console.trace('on read_lock', req.query);

	let hash = req.query.hash;	
	let lock = locks[hash]
	console.log(locks);
	if (lock){
		res.send({err:0, result:lock});
	} else {
		res.send({err:1});
	}
});

app.get('/api/v1/minted', async (req, res) => {
	console.trace('on minted', req.body);
	res.send(minted);
});

app.get('/api/v1/account', async (req, res) => {
	console.trace('on account', req.query);
	try {
		let address = req.query.address;
		let account = ledger.filter(t => t.address === address);
		console.silly(`account = `, account);
		res.send({err:0, result:{account}});
	} catch(e){
		console.error(e);
		res.send({err:1, error:e.toString()});
	}
});

app.get('/api/v1/tokens', async (req, res) => {
	console.trace('on tokens', req.query);
	res.send(tokens);
});

app.listen(config.port, function(){
	console.info('Service started at ::', config.port);
});
