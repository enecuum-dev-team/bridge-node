let express = require('express');
let cors = require('cors');
let crypto = require('crypto');

let EthereumNetwork = require('./provider_ethereum.js');
let EnecuumNetwork = require('./provider_enecuum.js');
let TestNetwork = require('./provider_test.js');

let calculate_transfer_id = function(ticket){
	let param_names = ["dst_address", "dst_network", "amount", "src_hash", "src_address", "src_network", "origin_hash", "origin_network", "nonce", "ticker"];

	let params_str = param_names.map(v => crypto.createHash('sha256').update(ticket[v].toString().toLowerCase()).digest('hex')).join("");

	let transfer_id = crypto.createHash('sha256').update(params_str).digest('hex');

	return transfer_id;
}


let decimals = [];
decimals[1] = 10;
decimals[5] = 18;
decimals[17] = 2;
decimals[23] = 3;
decimals[29] = 4;

module.exports = class Node {
	constructor(config) {
		this.config = config;
		this.app = express();
		this.app.use(cors({origin: '*'}));

		this.app.use(express.json());

		this.app.post('/api/v1/encode_lock', async (req, res) => {
			console.trace('on encode_lock', req.body);
			let {dst_address, dst_network, amount, src_hash, src_network} = req.body;

			try {
				let src_network_obj = config.networks.filter((network) => {return BigInt(network.network_id) === BigInt(src_network)})[0];

				if (src_network_obj){	
					let encoded_data = src_network_obj.provider.encode_lock_data({dst_address, dst_network, amount, src_hash});
					let result = {encoded_data};
					res.send(result);
				} else {
					res.send({err:1});
				}
			} catch(e){
				console.error(e);
				res.send({err:1});
			}
		});
		this.app.get('/api/v1/get_dst_decimals', async (req, res) => {
			console.trace(`on get_dst_decimals ${JSON.stringify(req.query)}`);

			let response;
			try {
				let {hash, src_network_id, dst_network_id} = req.query;
	
				// choose source network
				let src_network = config.networks.filter((network) => {return network.network_id === Number(src_network_id)})[0];
				if (src_network === undefined){
					console.error(`Failed to select source network - wrong src_network_id ${src_network_id}`);
					throw(`failed to select network`);
				}

				console.info(`Checking smart contract state at ${src_network.caption}...`);
				let src_state = await src_network.provider.read_state(hash);
				if (!src_state){
					console.error(`Failed to read smart contract state at ${src_network.caption}`);
					throw(`failed to read state`);
				}
				console.info(`src_state = ${JSON.stringify(src_state)}`);

				let minted_data = src_state.minted.find((minted)=>{return minted.wrapped_hash === hash});
				console.debug(`minted_data = ${JSON.stringify(minted_data)}`);

				if (minted_data){
					// choose origin network
					let origin_network_id = Number(minted_data.origin_network);
					let org_network = config.networks.filter((network) => {return network.network_id === origin_network_id})[0];
					if (org_network === undefined){
						console.error(`Failed to select source network - wrong origin_network_id ${origin_network_id}`);
						throw(`failed to select network`);
					}

					// reading origin token info
					console.info(`Checking token info for ${minted_data.origin_hash} at ${org_network.caption}...`);
					let token_info = await org_network.provider.get_token_info(minted_data.origin_hash);
					if (!token_info){
						console.error(`Failed to read token_info for ${minted_data.origin_hash}`);
						throw(`failed to read token info from selected network`);
					}
					console.info(`Token info for ${minted_data.origin_hash} = ${JSON.stringify(token_info)}`);

					let dst_decimals = token_info.decimals;
					console.trace(`dst_decimals = ${dst_decimals}`);
					if (dst_decimals){
						response = {result: {dst_decimals}, err:0};
					} else {
						throw "Cannot read decimals from token_info";
					}

				} else {
					let dst_decimals = decimals[dst_network_id];
					console.trace(`dst_decimals = ${dst_decimals}`);
					if (dst_decimals){
						response = {result: {dst_decimals}, err:0};
					} else {
						throw "Cannot read decimals from dst_network";
					}
				}
			} catch(e){
				console.error(e);
				response = {err:1};
			}
			console.trace(`response = ${JSON.stringify(response)}`);
			res.send(response);
		});

		this.app.post('/api/v1/notify', async (req, res) => {

			console.trace('on notify', req.body);

			let {networkId, txHash} = req.body;

			// choose source network
			let src_network = config.networks.filter((network) => {return network.network_id === networkId})[0];
			if (src_network === undefined){
				console.error(`Failed to select source network - wrong networkId ${networkId}`);
				res.send({err:1});
				return;
			} 

			// reading lock information from source network
			console.info(`Checking lock for ${txHash} at ${src_network.caption}...`);
			let lock = await src_network.provider.read_lock(txHash);
			if (!lock){
				console.error(`Failed to read lock data for ${txHash}`);
				res.send({err:1});
				return;
			}
			console.info(`Lock data for ${txHash} = ${JSON.stringify(lock)}`);

			// reading locked token info
			console.info(`Checking token info for ${lock.src_hash} at ${src_network.caption}...`);
			let token_info = await src_network.provider.get_token_info(lock.src_hash);
			if (!token_info){
				console.error(`Failed to read token_info for ${lock.src_hash}`);
				res.send({err:1});
				return;
			}
			console.info(`Token info for ${lock.src_hash} = ${JSON.stringify(token_info)}`);

			// choose destination network
			let dst_network = config.networks.filter((network) => {return BigInt(network.network_id) === BigInt(lock.dst_network)})[0];

			if (dst_network === undefined){
				console.error(`Failed to select destination network - ${lock.dst_network}`);
				res.send({err:1});
				return;
			}

			console.info(`Checking smart contract state at ${src_network.caption}...`);
			let src_state = await src_network.provider.read_state(lock.src_hash);
			if (!src_state){
				console.error(`Failed to read smart contract state at ${src_network.caption}`);
				res.send({err:1});
				return;
			}
			console.info(`src_state = ${JSON.stringify(src_state)}`);

			console.info(`Checking transfers at ${dst_network.caption}...`);
			let transfer = await dst_network.provider.read_transfers(lock.src_address, lock.src_hash, src_state.network_id, lock.dst_address);
			if (!transfer){
				console.error(`Failed to read transfers at ${src_network.caption}`);
				res.send({err:1});
				return;
			} else {

			}
			console.info(`Transfer = ${JSON.stringify(transfer)}`);

			//creating confirmation
			let ticket = {};

			//  calculating amount
			//ticket.amount = lock.amount * 10n ** BigInt(token_info.decimals);
			//ticket.amount = lock.amount;
			let src_decimals = decimals[src_network.network_id];
			let dst_decimals = decimals[dst_network.network_id];

			console.trace(`Calculating amount for src_decimals = ${src_decimals}, dst_decimals = ${dst_decimals}`);
			if (src_decimals && dst_decimals){
				if (dst_decimals < src_decimals){
					ticket.amount = Number(BigInt(lock.amount) / (BigInt(10) ** BigInt(src_decimals - dst_decimals)));
				} else if (src_decimals < dst_decimals){
					ticket.amount = Number(BigInt(lock.amount) * (BigInt(10) ** BigInt(dst_decimals - src_decimals)));
				} else {
					ticket.amount = lock.amount;
				}
			} else {
				console.error(`Failed to obtain decimals data`);
				res.send({err:1});
				return;
			}

			//	from lock
			ticket.dst_address = lock.dst_address;
			ticket.dst_network = lock.dst_network;
			ticket.src_hash = lock.src_hash;
			ticket.src_address = lock.src_address;

			//	from source
			ticket.src_network = src_state.network_id;

			let minted_data = src_state.minted.find((minted)=>{console.silly(`${JSON.stringify(minted)}, ${lock.src_hash}`); return minted.wrapped_hash === lock.src_hash});
			console.debug(`minted_data = ${JSON.stringify(minted_data)}`);

			ticket.ticker = dst_network.provider.create_ticker_from(token_info.ticker);
			if (minted_data){
				ticket.origin_hash = minted_data.origin_hash;
				ticket.origin_network = minted_data.origin_network;
			} else {
				ticket.origin_hash = ticket.src_hash;
				ticket.origin_network = ticket.src_network;
			}

			//  from destination
			if (transfer[0]){
				console.silly(`incrementing transfer nonce ${transfer[0].nonce}`);
				ticket.nonce = Number(transfer[0].nonce) + 1;
			} else {
				ticket.nonce = 1;
			}

			console.info(`ticket = ${JSON.stringify(ticket)}`);

			let confirmation = {};

			confirmation.ticket = ticket;
			confirmation.validator_id = dst_network.pubkey;

			try {
				confirmation.transfer_id = calculate_transfer_id(ticket);
			} catch(e){
				console.error(`failed to calculate_transfer_id for ${JSON.stringify(ticket)}`);
				console.error(e);
				res.send({});
			}

			confirmation.validator_sign = dst_network.provider.sign(confirmation.transfer_id);

			// encoded data
			if (dst_network.provider.type === "enecuum"){
				confirmation.encoded_data = {};
				confirmation.encoded_data.enq = {};
				confirmation.encoded_data.enq.init = dst_network.provider.encode_init_data(confirmation);
				confirmation.encoded_data.enq.confirm = dst_network.provider.encode_confirm_data(confirmation);
			}

			res.send(confirmation);
		});
	}

	async start(){
		this.initialize_providers();

		this.app.listen(this.config.port, function(){
			console.info('Explorer started at ::', this.config.port);
		}.apply(this));
	}

	async initialize_providers(){
		console.info(`Initializing networks...`);
		this.config.networks.forEach(async (network) => {
			switch(network.type){
				case 'ethereum':
					network.provider = new EthereumNetwork(network);
					break;
				case 'enecuum':
					network.provider = new EnecuumNetwork(network);
					break;
				case 'test':
					network.provider = new TestNetwork(network);
					break;
				default:
					console.fatal(`Unknown network type - ${network.type}`)
			}

			console.info(`Checking smart contract state at ${network.caption}...`);
			let state = await network.provider.read_state();
			if (!state){
				console.fatal(`Failed to read smart contract state at ${network.caption}`);
			}
			console.info(`Smart contract state = ${JSON.stringify(state)}`);

			if (state.network_id){
				network.network_id = state.network_id;
			} else {
				console.warn(`network_id for ${network.caption} not set, setting to -1`);
				network.network_id = -1;
			}
		});
	}
}