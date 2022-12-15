let Network = require('./provider_abstract.js');
let Web3 = require('web3');

let erc20_abi = [
  // balanceOf
  {
    constant:true,
    inputs:[{"name":"_owner","type":"address"}],
    name:"balanceOf",
    outputs:[{"name":"balance","type":"uint256"}],
    type:"function"
  },
  // decimals
  {
    constant:true,
    inputs:[],
    name:"decimals",
    outputs:[{"name":"","type":"uint8"}],
    type:"function"
  }
];

module.exports = class EthereumNetwork extends Network{
	constructor(network_config){
		super(network_config);
		this.type = "ethereum";

		this.abi = network_config.abi;
		this.contract_address = network_config.contract_address;
		this.prvkey = network_config.prvkey;

		if (network_config.type !== this.type){
			console.fatal(`Network config initialization failed due type mismatch: ${this.type} required instead ${network_config.type}`);
		}

		this.web3 = new Web3(new Web3.providers.HttpProvider(network_config.url));
	}

	async send_lock(params){
		console.trace(`Sending lock with params ${JSON.stringify(params)} at ${this.caption}`);

		try {
			let {dst_address, dst_network, amount, src_hash, src_address} = params;

			let bridge_contract = await new this.web3.eth.Contract(this.abi, this.contract_address);
			let lock_tx = bridge_contract.methods.lock(Buffer.from(dst_address), dst_network, amount, src_hash);

			let est_gas = 10000000;

			let tx = await this.web3.eth.accounts.signTransaction({to:this.contract_address, data:lock_tx.encodeABI(), gas:est_gas}, this.prvkey);
			console.trace(`tx = ${JSON.stringify(tx)}`);

			let receipt = await this.web3.eth.sendSignedTransaction(tx.rawTransaction);
			console.trace(`lock_hash = ${receipt.transactionHash}`);			

			return receipt.transactionHash;
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async send_claim_init(params){
		console.trace(`Sending claim with params ${JSON.stringify(params)} at ${this.caption}`);

		try {
			let bridge_contract = await new this.web3.eth.Contract(this.abi, this.contract_address);

			let claim_params = [params.ticket.dst_address,
				params.ticket.dst_network,
				params.ticket.amount,
				Buffer.from(params.ticket.src_hash, 'hex'),
				Buffer.from(params.ticket.src_address, 'hex'),
				params.ticket.src_network,
				Buffer.from(params.ticket.origin_hash, 'hex'),
				params.ticket.origin_network,
				params.ticket.nonce,
				"wrapped",
				params.ticket.ticker
				];

			//console.silly(claim_params);
			
			let claim_tx = bridge_contract.methods.claim(claim_params, []);

			let est_gas = 1000000;

			let tx = await this.web3.eth.accounts.signTransaction({to:this.contract_address,data:claim_tx.encodeABI(),gas:est_gas}, this.prvkey);
			console.trace(`tx = ${JSON.stringify(tx)}`);

			let receipt = await this.web3.eth.sendSignedTransaction(tx.rawTransaction);
			console.trace(`claim_hash = ${receipt.transactionHash}`);			

			return receipt.transactionHash;
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async send_claim_confirm(params, claim_init_hash){
		console.trace(`Sending idle with existing hash ${claim_init_hash}`);
		return claim_init_hash;
	}

	async get_balance(address, hash){
		console.trace(`Reading account ${address} at ${this.caption}`);

		try {
			if (hash === undefined){
				return {}
			} else {
				let erc20_contract = new this.web3.eth.Contract(erc20_abi, hash);
				let erc20_balance = await erc20_contract.methods.balanceOf(address).call();
				let result = {};
				result[hash] = BigInt(erc20_balance);
				return result;
			}
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async wait_lock(tx_hash){
		console.trace(`Waiting for lock transaction ${tx_hash} at ${this.caption}`);
		try {
			let receipt = await this.web3.eth.getTransactionReceipt(tx_hash);
			if (receipt){
				return true;
			}
			else {
				return false;
			}
		} catch(e){
			console.error(e);
			return false;
		}
	}

	async wait_claim(tx_hash){
		console.trace(`Waiting for claim transaction ${tx_hash} at ${this.caption}`);
		try {
			let receipt = await this.web3.eth.getTransactionReceipt(tx_hash);
			if (receipt){
				return true;
			}
			else {
				return false;
			}
		} catch(e){
			console.error(e);
			return false;
		}
	}

	async read_lock(tx_hash){
		console.trace(`Extracting lock data for tx_hash ${tx_hash} at ${this.caption}`);

		try {
			let receipt = await this.web3.eth.getTransactionReceipt(tx_hash);

			let log_entry = receipt.logs.filter((entry) => {return entry.address === this.contract_address})[0];
			if (!log_entry){
				console.error(`Failed to retrive log entry for ${this.contract_address}`);
				console.trace(receipt);
				return;
			}

			let topic = this.web3.utils.sha3("Lock(bytes,uint24,uint256,address,address)");

			let params = this.web3.eth.abi.decodeParameters(['bytes', 'uint24', 'uint256', 'address', 'address'], log_entry.data);

			console.trace(`Extracted params ${JSON.stringify(params)}`);

			//let dst_address = this.web3.utils.hexToAscii(params["0"]);
			let dst_address = new TextDecoder().decode(Buffer.from(params["0"].slice(2), 'hex'))
			let dst_network = params["1"];
			let amount = params["2"];
			let src_hash = params["3"].slice(2);
			let src_address = params["4"].slice(2);
			let ticker = 'wra';

			return {dst_address, dst_network, amount, src_hash, src_address, ticker};
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async read_claim(tx_hash){
		console.trace(`Extracting claim_data for ${tx_hash} at ${this.caption}`);

		try {
			let receipt = await this.web3.eth.getTransactionReceipt(tx_hash);

			let log_entry = receipt.logs.filter((entry) => {return entry.address === this.contract_address})[0];
			if (!log_entry){
				console.error(`Failed to retrive log entry for ${this.contract_address}`);
				console.trace(receipt);
				return;
			}

			return {dst_address, dst_network, amount, src_hash, src_address, ticker};
		} catch(e){
			console.error(e);
			return null;
		}
	}


	async read_transfers(src_address, src_hash, src_network, dst_address){
		console.trace(`Extracting transfers for src_address=${src_address} & src_hash=${src_hash} & src_network=${src_network} & dst_address=${dst_address} at ${this.caption}`);

		try {
		 	let contract = await new this.web3.eth.Contract(this.abi, this.contract_address);

		 	let params = [];
		 	params[0] = Buffer.from(src_address, 'hex');
		 	params[1] = Buffer.from(src_hash, 'hex');
		 	params[2] = Number(src_network);
		 	params[3] = dst_address;

		 	console.debug(`get_transfer call params: ${JSON.stringify(params)}`);

	 		let nonce = await contract.methods.get_transfer(...params).call();

	 		//console.log(nonce);
	 		//process.exit(0);
	 		if (nonce === 0){
	 			return [];
	 		} else {
	 			return [{src_address, src_hash, src_network, dst_address, nonce}];
	 		}


			return true;
		} catch(e){
			console.error(e);
			return false;
		}
	}

	async read_state(){
		console.trace(`Reading state of contract ${this.contract_address} at ${this.caption}`);
	 	let contract = await new this.web3.eth.Contract(this.abi, this.contract_address);
 		let network_id = await contract.methods.network_id().call();
 		//let minted = await contract.methods.minted(111).call();
 		let minted = [];

 		return {network_id, minted};
	}

	sign(msg){
		try {
			console.error("Sign not implemented");
			console.trace(`signing ${msg}`);
		} catch(e){
			console.error(e);
			return false;
		}
	}
}