let express = require('express');
let cors = require('cors');
let crypto = require('crypto');
let fs = require('fs');

let argv = require('yargs').argv;

const CONFIG_FILENAME = 'config.json';
let config = {
	"port" : 8011,
	"loglevel" : "silly",
	"network_id" : 11,
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

let SMART_ADDRESS = "smart";
let minted = [];
let transactions = {};
let state = {
	tokens :[],
	ledger :{}
}

try {
	state = JSON.parse(fs.readFileSync(config.state_filename, 'utf8'));
} catch(e){
	console.info(`Cannot read state file - ${e.toString()}`);
}

console.info(`state = ${JSON.stringify(state)}`);

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

let create_token = function(ticker){
	let hash = random_hash();
	state.tokens.push({hash, ticker});
	return hash;
}

let get_amount = function(address, hash){
	try {
		return state.ledger[address][hash];
	} catch(e){
		return undefined;
	}
}

let add_amount = function(address, hash, amount){
	if (state.ledger[address]){
		if (state.ledger[address][hash]){
			state.ledger[address][hash] += amount;
		} else {
			state.ledger[address][hash] = amount
		}
	} else {
		state.ledger[address] = {};
		state.ledger[address][hash] = amount;
	}
}

app.post('/api/v1/lock', async (req, res) => {
	console.trace(`on lock ${JSON.stringify(req.body)}`);
	let result = undefined;

	try {
		let {dst_address, dst_network, amount, src_hash, src_address} = req.body;

		let tx_hash = random_hash();

		setTimeout(function(){
			if (get_amount(src_address, src_hash) >= amount){

				add_amount(src_address, src_hash, -1 * amount);
				add_amount(SMART_ADDRESS, src_hash, amount);

				transactions[tx_hash] = {dst_address, dst_network, amount, src_hash, src_address};

				console.info(`assets locked successfully`);
			} else {
				console.error(`not enough funds at account ${src_address}`);
				transactions[tx_hash] = null;
			}
		}, config.tx_confirmation_delay);

		result = {err:0, result:{hash:tx_hash}};
	} catch(e){
		result = {err:1, error:e.toString()};
	}

	console.trace(`result = ${JSON.stringify(result)}`);
	res.send(result);
});

app.post('/api/v1/claim', async (req, res) => {
	console.trace(`on claim ${JSON.stringify(req.body)}`);
	let result = undefined;
	
	try {
		let {dst_address, dst_network, amount, src_hash, src_address, ticker, src_network, origin_hash, origin_network, nonce} = req.body.ticket;

		let tx_hash = random_hash();

		setTimeout(function(){
			let token_hash = create_token(ticker);
			transactions[tx_hash] = {dst_hash:token_hash};
		}, config.tx_confirmation_delay);

		result = {err:0, result:{hash:tx_hash}};
	} catch(e){
		result = {err:1, error:e.toString()};
	}

	console.trace(`result = ${JSON.stringify(result)}`);
	res.send(result);
});

app.get('/api/v1/network_id', async (req, res) => {
	console.trace('on network_id', req.body);
	res.send({network_id:config.network_id});
});

app.get('/api/v1/transfers', async (req, res) => {
	console.trace('on transfers', req.query);
	res.send({});
});

app.get('/api/v1/read_transaction', async (req, res) => {
	console.trace(`on read_transaction ${JSON.stringify(req.query)}`);
	let result = undefined;

	let hash = req.query.hash;	
	let lock = transactions[hash];
	if (lock !== undefined){
		result = {err:0, result:lock};
	} else {
		result = {err:1};
	}
	console.trace(`result = ${JSON.stringify(result)}`);
	res.send(result);
});

app.get('/api/v1/minted', async (req, res) => {
	console.trace('on minted', req.body);
	res.send(minted);
});

app.get('/api/v1/account', async (req, res) => {
	console.trace(`on account ${JSON.stringify(req.query)}`);
	let result = undefined;
	try {
		//account = state.ledger[account];
		if (state.ledger[req.query.address]){
			result = {err:0, result:state.ledger[req.query.address]};
		} else {
			result = {err:0, result:{}};
		}
	} catch(e){
		console.error(e);
		result = {err:1, error:e.toString()};
	}

	console.trace(`result = ${JSON.stringify(result)}`);
	res.send(result);
});

app.get('/api/v1/tokens', async (req, res) => {
	console.trace('on tokens', req.query);
	res.send(state.tokens);
});

app.get('/api/v1/state', async (req, res) => {
	console.trace(`on state ${JSON.stringify(req.query)}`);
	let result = [state, transactions];

	console.trace(`result = ${JSON.stringify(result)}`);
	res.send(result);
});

app.listen(config.port, function(){
	console.info('Service started at ::', config.port);
});
