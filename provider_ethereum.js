let Network = require('./provider_abstract.js');
let web3 = require('web3');

module.exports = class EthereumNetwork extends Network{
	constructor(network_config){
		super(network_config);
		this.type = "ethereum";

		this.abi = network_config.abi;

		if (network_config.type !== this.type){
			console.fatal(`Network config initialization failed due type mismatch: ${this.type} required instead ${network_config.type}`);
		}

		this.Web3 = new web3(new web3.providers.HttpProvider(network_config.url));
	}

	async send_lock(params){
		console.trace(`Sending lock with params ${JSON.stringify(params)} at ${this.caption}`);

		try {
			throw "Not implemented";
			return null;
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async send_claim(params){
		console.trace(`Sending claim with params ${JSON.stringify(params)} at ${this.caption}`);

		try {
			throw "Not implemented";
			return null;
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async get_balance(address, hash){
		console.trace(`Reading account ${address} at ${this.caption}`);

		try {
			throw "Not implemented";
			return null;
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async wait_lock(tx_hash){
		console.trace(`Waiting for lock transaction ${tx_hash} at ${this.caption}`);
		try {
			throw "Not implemented";
			return true;
		} catch(e){
			console.error(e);
			return false;
		}
	}

	async wait_claim(tx_hash){
		console.trace(`Waiting for claim transaction ${tx_hash} at ${this.caption}`);
		try {
			throw "Not implemented";
			return true;
		} catch(e){
			console.error(e);
			return false;
		}
	}


	async read_lock(tx_hash){
		console.trace(`Extracting log for tx_hash ${tx_hash} at ${this.caption}`);

		let receipt = await this.Web3.eth.getTransactionReceipt(tx_hash);

		let log_entry = receipt.logs.filter((entry) => {return entry.address === this.contract_address})[0];
		if (!log_entry){
			console.error(`Failed to retrive log entry for ${this.contract_address}`);
			console.trace(receipt);
			return;
		}

		let topic = this.Web3.utils.sha3("Lock(bytes,uint24,uint256,address,address)");

		let params = this.Web3.eth.abi.decodeParameters(['bytes', 'uint24', 'uint256', 'address', 'address'], log_entry.data);

		console.trace(`Extracted params ${JSON.stringify(params)}`);

		let dst_address = params["0"];
		let dst_network = params["1"];
		let amount = params["2"];
		let src_hash = params["3"];
		let src_address = params["4"];
		let ticker = 'wra';

		//trim 0x
		dst_address = dst_address.slice(2);
		src_address = src_address.slice(2);
		src_hash = src_hash.slice(2);

		return {dst_address, dst_network, amount, src_hash, src_address, ticker};
	}

	async read_claim(tx_hash){
		console.trace(`Extracting claim_data for ${tx_hash} at ${this.caption}`);

		try {
			throw "Not implemented";
			return null;
		} catch(e){
			console.error(e);
			return null;
		}
	}


	async read_transfers(src_address, src_hash, src_network, dst_address){
		console.trace(`Extracting transfers for src_address=${src_address} & src_hash=${src_hash} & src_network=${src_network} & dst_address=${dst_address} at ${this.caption}`);

		try {
			throw "Not implemented";
			return true;
		} catch(e){
			console.error(e);
			return false;
		}
	}

	async read_state(){
		console.trace(`Reading state of contract ${this.contract_address} at ${this.caption}`);
	 	let contract = await new this.Web3.eth.Contract(this.abi, this.contract_address);
 		let network_id = await contract.methods.network_id().call();
 		//let minted = await contract.methods.minted(111).call();
 		let minted = [];

 		return {network_id, minted};
	}

	sign(msg){
		try {
			throw "Not implemented";
			console.trace(`signing ${msg}`);
		} catch(e){
			console.error(e);
			return false;
		}
	}
}