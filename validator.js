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

module.exports = class Node {
	constructor(config) {
		this.config = config;
		this.app = express();
		this.app.use(cors());

		this.app.use(express.json());

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

			// choose destination network
			let dst_network = config.networks.filter((network) => {return network.network_id === lock.dst_network})[0];

			if (dst_network === undefined){
				console.error(`Failed to select destination network - ${lock.dst_network}`);
				res.send({err:1});
				return;
			}

			console.info(`Checking smart contract state at ${src_network.caption}...`);
			let src_state = await src_network.provider.read_state();
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

			//	from lock
			ticket.dst_address = lock.dst_address;
			ticket.dst_network = lock.dst_network;
			ticket.amount = lock.amount;
			ticket.src_hash = lock.src_hash;
			ticket.src_address = lock.src_address;

			//	from source
			ticket.src_network = src_state.network_id;

			let minted_data = src_state.minted.find((minted)=>{console.silly(`${JSON.stringify(minted)}, ${lock.src_hash}`); return minted.wrapped_hash === lock.src_hash});
			console.debug(`minted_data = ${JSON.stringify(minted_data)}`);

			if (minted_data){
				ticket.origin_hash = minted_data.origin_hash;
				ticket.origin_network = minted_data.origin_network;
				ticket.ticker = "DUMMY";
			} else {
				ticket.origin_hash = ticket.src_hash;
				ticket.origin_network = ticket.src_network;
				ticket.ticker = "wr" + lock.ticker;
			}

			//  from destination
			if (transfer[0]){
				ticket.nonce = transfer[0].nonce + 1;
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

			network.network_id = state.network_id;
		});
	}
}