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
let transfers = [];

let state = {
	tokens :[],
	ledger :{},
	known_networks: [],
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

let create_token = function(ticker, name, decimals){
	let hash = random_hash();
	state.tokens.push({hash, ticker, decimals, name});
	return hash;
}

let get_amount = function(address, hash){
	try {
		return state.ledger[address][hash];
	} catch(e){
		return undefined;
	}
}

let move_amount = function(from, to, hash, amount){
	if (state.ledger.from < amount){
		console.error(`Not enough funds: ledger[${from}][${hash}] < ${amount}`);
		throw `Not enough funds`;
	} else {
		add_amount(from, hash, -1 * amount);
		add_amount(to, hash, amount);
	}
}

let add_amount = function(address, hash, amount){
	if (state.ledger[address]){
		if (state.ledger[address][hash]){
			let upd = state.ledger[address][hash] + Number(amount);
			if (upd < 0){
				console.error(`Negative ledger[${address}][${hash}] = ${upd}`);
			} else {
				state.ledger[address][hash] = upd;
			}
		} else {
			state.ledger[address][hash] = Number(amount);
		}
	} else {
		state.ledger[address] = {};
		state.ledger[address][hash] = Number(amount);
	}	
}

app.post('/api/v1/lock', async (req, res) => {
	console.trace(`on lock ${JSON.stringify(req.body)}`);
	let result = undefined;

	try {
		let {dst_address, dst_network, amount, src_hash, src_address, nonce} = req.body;

		let tx_hash = random_hash();

		setTimeout(function(){

			let dst_network_info = state.known_networks.find(n => n.id === dst_network);

			if (dst_network_info === undefined){
				console.error(`Unknown network - ${dst_network}`)
				transactions[tx_hash] = null;
			} else {
				if (get_amount(src_address, src_hash) >= amount){

					add_amount(src_address, src_hash, -1 * amount);
					add_amount(SMART_ADDRESS, src_hash, amount);

					transactions[tx_hash] = {dst_address, dst_network, amount, src_hash, src_address, nonce};

					console.info(`assets locked successfully`);
				} else {
					console.error(`not enough funds at account ${src_address}`);
					transactions[tx_hash] = null;
				}
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
		let {dst_address, dst_network, amount, src_hash, src_address, ticker, src_network, origin_hash, origin_network, nonce, name, origin_decimals} = req.body.ticket;

		let tx_hash = random_hash();

		setTimeout(function(){
			let minted_hash;

			let transfer_i = transfers.findIndex((t) => {return (t.src_hash === src_hash) && (t.src_address === src_address) && (t.dst_address === dst_address) && (t.src_network === src_network);});

			let inner_nonce = 0;
			if (transfer_i > -1)
				inner_nonce = transfers[transfer_i].nonce;

			if (inner_nonce + 1 !== nonce){
				console.warn(`Nonces do not match - ${JSON.stringify(transfers[transfer_i])} and ${nonce}!`);				
			} else {
				if (Number(origin_network) === config.network_id){
					console.debug(`Unlocking old token`);
					move_amount(SMART_ADDRESS, dst_address, origin_hash, amount);
					transactions[tx_hash] = {dst_hash:origin_hash};
				} else {	
					let minted_i = minted.findIndex((m) => {return (m.origin_hash === origin_hash) && (m.origin_network === origin_network)});

					if (minted_i > -1){
						console.debug(`Minting existing wrapper`);
						let wrapped_hash = minted[minted_i].wrapped_hash;

						transactions[tx_hash] = {dst_hash:wrapped_hash};
						add_amount(dst_address, wrapped_hash, amount);
					} else {
						console.debug(`Creating new wrapper`);
						let decimals = Math.min(state.decimals, origin_decimals);
						minted_hash = create_token(ticker, name, decimals);
						minted.push({wrapped_hash:minted_hash, origin_hash, origin_network, decimals, origin_decimals});

						transactions[tx_hash] = {dst_hash:minted_hash};
						add_amount(dst_address, minted_hash, amount);
					}
				}

				if (transfer_i === -1){
					console.debug(`adding new transfer`);
					transfers.push({src_address, dst_address, src_network, src_hash, nonce});
				} else {
					console.debug(`incrementing existing transfer`);
					transfers[transfer_i].nonce++;
				}
			}

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
	let response = {network_id:config.network_id};
	console.trace(response);
	res.send(response);
});

app.get('/api/v1/transfers', async (req, res) => {
	console.trace('on transfers', req.query);
	let result;

	try {
		let {src_address, dst_address, src_network, src_hash} = req.query;

		let tuple = transfers.filter((t) => {return (t.src_hash === src_hash) && (t.src_address === src_address) && (t.dst_address === dst_address) && (t.src_network.toString() === src_network);});

		result = {err:0, result:tuple};
	} catch(e){
		console.warn(e.toString());
		result = {err:1};
	}

	console.trace(`result = ${JSON.stringify(result)}`);
	res.send(result);
});

app.get('/api/v1/token_info', async (req, res) => {
	console.trace('on token_info', req.query);
	let result;

	try {
		let {hash} = req.query;

		let token = state.tokens.filter((t) => {return (t.hash === hash)});

		result = {err:0, result:token[0]};
	} catch(e){
		console.warn(e.toString());
		result = {err:1};
	}

	console.trace(`result = ${JSON.stringify(result)}`);
	res.send(result);
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

app.get('/api/v1/known_networks', async (req, res) => {
	console.trace('on known_networks', req.body);
	if (state.known_networks){
		res.send(state.known_networks);
	} else {
		res.send([]);
	}
});

app.get('/api/v1/account', async (req, res) => {
	console.trace(`on account ${JSON.stringify(req.query)}`);
	let result = undefined;
	try {
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
	let result = {state, transactions, transfers, minted};

	console.trace(`result = ${JSON.stringify(result)}`);
	res.send(result);
});

app.listen(config.port, function(){
	console.info('Service started at ::', config.port);
});
