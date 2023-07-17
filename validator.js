let express = require('express');
let cors = require('cors');
let crypto = require('crypto');

let EthereumNetwork = require('./provider_ethereum.js');
let EnecuumNetwork = require('./provider_enecuum.js');
let TestNetwork = require('./provider_test.js');

let calculate_ticket_hash = function(ticket){
	let param_names = ["dst_address", "dst_network", "amount", "src_hash", "src_address", "src_network", "origin_hash", "origin_network", "nonce", "ticker", "origin_decimals", "name"];

	let params_str = param_names.map(v => crypto.createHash('sha256').update(ticket[v].toString().toLowerCase()).digest('hex')).join("");

	let ticket_hash = crypto.createHash('sha256').update(params_str).digest('hex');

	return ticket_hash;
}

let trim_0x = function(str){
    if (str.startsWith('0x'))
        return str.slice(2);
    return str;
}

let decimals = [];
decimals[1] = 10;
decimals[5] = 18;
decimals[17] = 2;
decimals[23] = 3;
decimals[29] = 4;
decimals[97] = 18;
decimals[66] = 10;
decimals[123] = 10;
decimals[80001] = 18;

module.exports = class Node {
	constructor(config) {
		this.config = config;
		this.app = express();
		this.app.use(cors({origin: '*'}));

		this.app.use(express.json());

		this.app.post('/api/v1/encode_lock', async (req, res) => {
			console.trace('on encode_lock', req.body);
			let {dst_address, dst_network, amount, src_hash, src_network, nonce} = req.body;

			try {
				let src_network_obj = config.networks.filter((network) => {return BigInt(network.network_id) === BigInt(src_network)})[0];

				if (src_network_obj){	
					let encoded_data = src_network_obj.provider.encode_lock_data({dst_address, dst_network, amount, src_hash, nonce});
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

		this.app.post('/api/v1/debug', async (req, res) => {
			console.trace(`on debug ${JSON.stringify(req.query)}`);

			let networkId = 97;

	
			let response;
			try {
				let network_obj = config.networks.filter((network) => {return BigInt(network.network_id) === BigInt(networkId)})[0];

				let {src_address, src_hash, src_network, dst_address} = {
					src_address: "03ee3c33589b1a4409b722fe85d3e76690a7779e860ce9926fa74a9c06fa4658ac",
					src_hash: "0000000000000000000000000000000000000000000000000000000000000001",
					src_network:1,
					dst_address:"0x9b3f74094cc459249046c27457fffec837fd5f57"};


				let result = await network_obj.provider.read_transfers(src_address, src_hash, src_network, dst_address);

				response = {result, err:0};
			} catch(e){
				console.error(e);
				response = {err:1};
			}
			console.trace(`response = ${JSON.stringify(response)}`);
			res.send(response);
		});

		this.app.get('/api/v1/get_dst_decimals', async (req, res) => {
			console.trace(`on get_dst_decimals ${JSON.stringify(req.query)}`);

			let response;
			try {
				let {hash, src_network_id, dst_network_id} = req.query;

				let dst_decimals;
				let org_decimals;
	
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
					console.info(`Checking token info for ${minted_data.origin_hash} at origin ${org_network.caption}...`);
					let org_token_info = await org_network.provider.get_token_info(minted_data.origin_hash);
					if (!org_token_info){
						console.error(`Failed to read token_info for ${minted_data.origin_hash}`);
						throw(`failed to read token info from selected network`);
					}

					org_decimals = org_token_info.decimals;
					console.debug(`minted_data specified, org_decimals = ${org_decimals}`);
				} else {
					console.info(`Checking token info for ${hash} at origin ${src_network.caption}...`);
					let src_token_info = await src_network.provider.get_token_info(hash);
					if (!src_token_info){
						console.error(`Failed to read token_info for ${hash}`);
						throw(`failed to read token info from selected network`);
					}
					org_decimals = src_token_info.decimals;
					console.debug(`minted_data not specified, org_decimals = ${org_decimals}`);
				}

				let result_decimals = Math.min(org_decimals, decimals[dst_network_id]);

				response = {result:{dst_decimals: result_decimals}, err:0}
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
			console.info(`Checking lock for ${txHash} at source ${src_network.caption}...`);
			let lock = await src_network.provider.read_lock(txHash);
			if (!lock){
				console.error(`Failed to read lock data for ${txHash}`);
				res.send({err:1});
				return;
			}
			console.info(`Lock data for ${txHash} = ${JSON.stringify(lock)}`);

			// reading locked token info
			console.info(`Checking locked token info for ${lock.src_hash} at source ${src_network.caption}...`);
			let token_info = await src_network.provider.get_token_info(lock.src_hash);
			if (!token_info){
				console.error(`Failed to read token_info for ${lock.src_hash}`);
				res.send({err:1});
				return;
			}
			console.info(`Token info for ${lock.src_hash} = ${JSON.stringify(token_info)}`);

			// choose destination network
			let dst_network = config.networks.filter((network) => {return Number(network.network_id) === Number(lock.dst_network)})[0];

			if (dst_network === undefined){
				console.error(`Failed to select destination network - ${lock.dst_network}`);
				res.send({err:1});
				return;
			}

			console.info(`Checking smart contract state at source ${src_network.caption}...`);
			let src_state = await src_network.provider.read_state(lock.src_hash);
			if (!src_state){
				console.error(`Failed to read smart contract state at ${src_network.caption}`);
				res.send({err:1});
				return;
			}
			console.info(`src_state = ${JSON.stringify(src_state)}`);

			//creating confirmation
			let ticket = {};

			//	from lock
			ticket.dst_address = lock.dst_address;
			ticket.dst_network = lock.dst_network;
			ticket.src_hash = lock.src_hash;
			ticket.src_address = lock.src_address;
			ticket.nonce = lock.nonce;

			//	from source
			ticket.src_network = src_state.network_id;

			console.info(`Retrieving minted data from ${src_network.caption}...`);
			let minted_data = src_state.minted.find((minted)=>{return minted.wrapped_hash === lock.src_hash});
			console.debug(`minted_data = ${JSON.stringify(minted_data)}`);

			let ticker;
			let name;
			let origin_decimals;

			if (minted_data){
				ticket.origin_hash = minted_data.origin_hash;
				ticket.origin_network = Number(minted_data.origin_network);

				// choose origin network
				let origin_network_id = Number(minted_data.origin_network);
				let org_network = config.networks.filter((network) => {return network.network_id === origin_network_id})[0];
				if (org_network === undefined){
					console.error(`Failed to select source network - wrong origin_network_id ${origin_network_id}`);
					throw(`failed to select network`);
				}

				// reading origin token info
				console.info(`Checking token info for ${minted_data.origin_hash} at origin ${org_network.caption}...`);
				let origin_token_info = await org_network.provider.get_token_info(minted_data.origin_hash);
				if (!origin_token_info){
					console.error(`Failed to read token_info for ${minted_data.origin_hash}`);
					throw(`failed to read token info from selected network`);
				}
				console.info(`Token info for ${minted_data.origin_hash} = ${JSON.stringify(origin_token_info)}`);

				ticker = origin_token_info.ticker;
				name = origin_token_info.name;
				origin_decimals = origin_token_info.decimals;
			} else {
				ticket.origin_hash = ticket.src_hash;
				ticket.origin_network = Number(ticket.src_network);

				ticker = token_info.ticker;
				name = token_info.name;
				origin_decimals = token_info.decimals;
				console.debug(`minted_data not specified, result = ${JSON.stringify({ticker, name, origin_decimals})}`);
			}

			ticket.ticker = dst_network.provider.create_ticker_from(ticker);

			if (name){
				ticket.name = dst_network.provider.create_name_from(name);
			} else {
				console.info(`No souce token name provided`);
				ticket.name = dst_network.provider.create_name_from("");
			}

			ticket.origin_decimals = origin_decimals;

			// AMOUNT
			let src_decimals = token_info.decimals;
			let dst_decimals;

			if (minted_data){
				console.info(`Source token is minted, checking direction ${minted_data.origin_network} and ${lock.dst_network}`)
				if (minted_data.origin_network == lock.dst_network){
					console.info(`Token is returning to origin network, reading original token decimals`)

					console.info(`Checking token info for ${minted_data.origin_hash} at origin ${dst_network.caption}...`);
					let origin_token_info = await dst_network.provider.get_token_info(minted_data.origin_hash);
					if (!origin_token_info){
						console.error(`Failed to read token_info for ${minted_data.origin_hash}`);
						throw(`failed to read token info from selected network`);
					}
					console.info(`Token info for ${minted_data.origin_hash} = ${JSON.stringify(origin_token_info)}`);

					dst_decimals = origin_token_info.decimals;
				} else {
					dst_decimals = decimals[dst_network.network_id];
				}
			} else {
				dst_decimals = decimals[dst_network.network_id];
			}

			console.trace(`Calculating amount for src_decimals = ${src_decimals}, dst_decimals = ${dst_decimals}, origin_decimals = ${origin_decimals}`);
			if (src_decimals && dst_decimals && origin_decimals){
				let target_decimals = Math.min(dst_decimals, origin_decimals);

				if (target_decimals < src_decimals){
					ticket.amount = BigInt(lock.amount.toString().slice(0, (target_decimals - src_decimals)));
				} else if (src_decimals < target_decimals){
					ticket.amount = BigInt(lock.amount) * (BigInt(10) ** BigInt(target_decimals - src_decimals));
				} else {
					ticket.amount = BigInt(lock.amount);
				}

				ticket.amount = ticket.amount.toString();
			} else {
				console.error(`Failed to obtain decimals data`);
				res.send({err:1});
				return;
			}

			// NONCE

			//  from destination
			/*
			if (transfer[0]){
				console.silly(`incrementing transfer nonce ${transfer[0].nonce}`);
				ticket.nonce = Number(transfer[0].nonce) + 1;
			} else {
				ticket.nonce = 1;
			}*/

			//ether workaround, possibly can cause problems with case-sensitive networks
			ticket.origin_hash = ticket.origin_hash.toLowerCase();
			ticket.origin_hash = trim_0x(ticket.origin_hash);

			console.info(`ticket = ${JSON.stringify(ticket)}`);

			let confirmation = {};

			confirmation.ticket = ticket;
			confirmation.validator_id = dst_network.pubkey;

			try {
				confirmation.ticket_hash = calculate_ticket_hash(ticket);
			} catch(e){
				console.error(`failed to calculate_ticket_hash for ${JSON.stringify(ticket)}`);
				console.error(e);
				res.send({});
			}

			//TODO: workaround
			if(dst_network.provider.type === "enecuum"){
				confirmation.validator_sign = dst_network.provider.sign(confirmation.ticket_hash);
			} else {
				confirmation.validator_sign = dst_network.provider.sign(ticket);
			}

			// encoded data
			if (dst_network.provider.type === "enecuum"){
				confirmation.encoded_data = {};
				confirmation.encoded_data.enq = {};
				//delete confirmation.ticket.name;
				confirmation.encoded_data.enq.init = dst_network.provider.encode_init_data(confirmation);
				confirmation.encoded_data.enq.confirm = dst_network.provider.encode_confirm_data(confirmation);
			}

			console.trace(`confirmation = ${JSON.stringify(confirmation)}`);

			if (!confirmation.validator_sign){
				console.error(`signing failed`);
				res.send({err:1});
			} else {
				res.send(confirmation);
			}
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