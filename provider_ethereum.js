let Network = require('./provider_abstract.js');
let Web3 = require('web3');

let erc20_abi = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];

//BigInt.prototype.toJSON = function() { return this.toString() };

let trim_0x = function(str){
    if (str.startsWith('0x'))
        return str.slice(2);
    return str;
}

module.exports = class EthereumNetwork extends Network{
	constructor(network_config){
		super(network_config);
		this.type = "ethereum";

		this.abi = network_config.abi;
		this.contract_address = network_config.contract_address;
		this.vault_address = network_config.vault_address;
		this.prvkey = network_config.prvkey;
		this.known_tokens = network_config.known_tokens;

		if (network_config.type !== this.type){
			console.fatal(`Network config initialization failed due type mismatch: ${this.type} required instead ${network_config.type}`);
		}

		this.web3 = new Web3(new Web3.providers.HttpProvider(network_config.url));
	}

	async send_lock(params){
		console.trace(`Sending lock with params ${JSON.stringify(params)} at ${this.caption}`);

		let est_gas = 300000;

		try {
			let {dst_address, dst_network, amount, src_hash, src_address} = params;

			let erc20_contract = new this.web3.eth.Contract(erc20_abi, src_hash);
			let allowance = await erc20_contract.methods.allowance(src_address, this.contract_address).call();

			console.trace(`${src_hash} allowance = ${allowance}`);

			if (allowance < amount){
				console.trace(`allowance too low, increasing...`);
				let allowance_tx = erc20_contract.methods.approve(this.vault_address, amount);

				let tx = await this.web3.eth.accounts.signTransaction({to:src_hash, data:allowance_tx.encodeABI(), gas:est_gas}, this.prvkey);
				console.trace(`tx = ${JSON.stringify(tx)}`);

				let receipt = await this.web3.eth.sendSignedTransaction(tx.rawTransaction);
				console.trace(`allowance_hash = ${receipt.transactionHash}`);			
			}

			let bridge_contract = await new this.web3.eth.Contract(this.abi, this.contract_address);
			let lock_params = [
					this.web3.utils.asciiToHex(dst_address),
					//Buffer.from(dst_address),
					dst_network,
					amount,
					src_hash
				];
			
			console.trace(`lock_params = ${JSON.stringify(lock_params)}`);

			let lock_tx = bridge_contract.methods.lock(...lock_params);

			let tx_data = lock_tx.encodeABI();

			let tx = await this.web3.eth.accounts.signTransaction({to:this.contract_address, data:tx_data, gas:est_gas}, this.prvkey);
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

			if (params.ticket.origin_hash.startsWith('0x')){
				params.ticket.origin_hash = params.ticket.origin_hash.slice(2);
				console.debug(`origin_hash trimmed to ${params.ticket.origin_hash}`);
			}

			let claim_params = [
				params.ticket.dst_address,
				params.ticket.dst_network,
				params.ticket.amount,
				params.ticket.src_hash,
				params.ticket.src_address,
				params.ticket.src_network,
				params.ticket.origin_hash,
				params.ticket.origin_network,
				params.ticket.nonce,
				params.ticket.name,
				params.ticket.ticker
				];

			console.silly(`claim_params = ${JSON.stringify(claim_params)}`);

			let signature = [params.validator_sign.v, params.validator_sign.r, params.validator_sign.s];
			//let signature = [];

			console.silly(`signature = ${JSON.stringify(signature)}`);

			let claim_tx = bridge_contract.methods.claim(claim_params, [signature]);

			let est_gas = 3000000;

			let nonce = await this.web3.eth.getTransactionCount(`0xf784C9bca8BbDD93A195aeCdBa23472f89B1E7d6`, 'pending');
			console.trace(`nonce = ${nonce}`);

			let gas_price = await this.web3.eth.getGasPrice();
			gas_price = Math.round(gas_price * 1.5);

			console.log(`gas_price = ${gas_price}`);			

			let tx = await this.web3.eth.accounts.signTransaction({to:this.contract_address,data:claim_tx.encodeABI(),gas:est_gas, gasPrice:gas_price, nonce}, this.prvkey);
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

	async add_known_token(hash){
		if (!this.known_tokens.includes(hash)){
			this.known_tokens.push(hash)
		}
	}

	async get_balance(address, hash){
		console.trace(`Reading account ${address} at ${this.caption}`);

		try {
			if (hash === undefined){
				let result = {};

				for (let token of this.known_tokens){
					try {
						let erc20_contract = new this.web3.eth.Contract(erc20_abi, token);
						let erc20_balance = await erc20_contract.methods.balanceOf(address).call();
						result[token] = BigInt(erc20_balance);
					} catch(e){
						console.warn(e);
					}
				}

				return result;
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

	async get_token_info(hash){
		console.trace(`Reading token_info for ${hash} at ${this.caption}`);

		try {
		  let token_contract = new this.web3.eth.Contract(erc20_abi, hash);
  		let ticker = await token_contract.methods.symbol().call();
  		let decimals = await token_contract.methods.decimals().call();
  		let name = await token_contract.methods.name().call();

  		let result = {ticker, decimals: Number(decimals), name};

  		console.trace(`result = ${JSON.stringify(result)}`);

  		return result;

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

			console.trace(`receipt = ${JSON.stringify(receipt)}`);

			let log_entry = receipt.logs.filter((entry) => {return entry.address === this.contract_address})[0];
			if (!log_entry){
				console.error(`Failed to retrive log entry for ${this.contract_address}`);
				console.trace(receipt);
				return;
			}

			let topic = this.web3.utils.sha3("Lock(bytes,uint24,uint256,address,address)");

			let params = this.web3.eth.abi.decodeParameters(['bytes', 'uint24', 'uint256', 'address', 'address'], log_entry.data);

			console.trace(`Extracted raw params ${JSON.stringify(params)}`);

			//let dst_address = this.web3.utils.hexToAscii(params["0"]);
			let dst_address = new TextDecoder().decode(Buffer.from(params["0"].slice(2), 'hex'));
			let dst_network = params["1"];
			let amount = params["2"];
			let src_hash = params["3"]/*.slice(2)*/;
			let src_address = params["4"]/*.slice(2)*/;
			let ticker = 'wra';

			let lock_data = {dst_address, dst_network, amount, src_hash, src_address, ticker};
			console.trace(`lock_data = ${JSON.stringify(lock_data)}`);

			return lock_data;
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async read_claim(tx_hash){
		console.trace(`Extracting claim_data for ${tx_hash} at ${this.caption}`);

		try {
			let receipt = await this.web3.eth.getTransactionReceipt(tx_hash);

			//console.log(receipt);

			let log = receipt.logs.filter((entry) => {return entry.address === this.contract_address});
			if (!log){
				console.error(`Failed to retrive log entry for ${this.contract_address}`);
				console.trace(receipt);
				return;
			}

			//console.log(log);

			let topic, params;

			let dst_hash, dst_address, amount;

			let event;

			log.forEach(log_entry => {
				if (log_entry.topics.includes('0xab8530f87dc9b59234c4623bf917212bb2536d647574c8e7e5da92c2ede0c9f8')){
					//mint
					topic = this.web3.utils.sha3("Claim(address,address,uint256)");
					params = this.web3.eth.abi.decodeParameters(['address ', 'address', 'uint256'], log_entry.data);
					
					console.trace(`Extracted params MINT ${JSON.stringify(params)}`);

					dst_hash = params["0"];
					dst_address = params["1"];
					amount = params["2"];

					event = {dst_hash, dst_address, amount};
				} else if (log_entry.topics.includes('0x6381d9813cabeb57471b5a7e05078e64845ccdb563146a6911d536f24ce960f1')){
					//unlock
					topic = this.web3.utils.sha3("Unlock(address,uint256)");
					params = this.web3.eth.abi.decodeParameters(['address ', 'uint256'], log_entry.data);

					console.trace(`Extracted params UNLOCK ${JSON.stringify(params)}`);

					dst_address = params["0"];
					amount = params["1"];
					event = {dst_address, amount};
				}
			});

			if (!event)
				throw "cannot read Mint or Unlock event by id (maybe topic id is wrong)";

			return event;
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
		 	params[0] = src_address;
		 	params[1] = src_hash;
		 	params[2] = Number(src_network);
		 	params[3] = dst_address;

		 	console.debug(`get_transfer call params: ${JSON.stringify(params)}`);

	 		let nonce = await contract.methods.get_transfer(...params).call();

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

	async read_state(hash){
		console.trace(`Reading state of contract ${this.contract_address} for (${hash})at ${this.caption}`);
	 	let contract = await new this.web3.eth.Contract(this.abi, this.contract_address);
 		let network_id = await contract.methods.network_id().call();

 		network_id = Number(network_id);
 		let minted = [];

 		if (hash){
			let tmp = await contract.methods.minted(hash).call();
	 		console.trace(tmp);
	 		if (tmp.origin_network != 0){
	 			minted.push({wrapped_hash : hash, origin_hash : trim_0x(tmp.origin_hash), origin_network : tmp.origin_network});
	 		}
 		}

 		return {network_id, minted};
	}

	create_ticker_from(origin_ticker){
		console.trace(`Creating new ethereum ticker from string ${origin_ticker}`);
		let result = 'SB' + origin_ticker;
		return result;
	}

	create_name_from(origin_name){
		console.trace(`Creating new ethereum name from string ${origin_name}`);
		let result = origin_name;
		return result;
	}

	sign(ticket){
		console.trace(`signing ${JSON.stringify(ticket)}`);

		try {
			let {amount, dst_address, dst_network, name, nonce, origin_hash, origin_network, src_address, src_network, src_hash, ticker} = ticket;
			let symbol = ticker;

			let values = [
				{value: amount.toString(), type: 'uint256'},
				{value: dst_address, type: 'address'},
				{value: dst_network, type: 'uint256'},
				{value: name, type: 'string'},
				{value: nonce, type: 'uint256'},
				{value: origin_hash, type: 'string'},
				{value: origin_network, type: 'uint256'},
				{value: src_address, type: 'string'},
				{value: src_hash, type: 'string'},
				{value: src_network, type: 'uint256'},
				{value: symbol, type: 'string'},
			];

			console.trace(`encoding values ${JSON.stringify(values)}`);
			let encoded = this.web3.utils.encodePacked(...values);

			console.trace(`encoded = ${encoded}`);

			let hashed = this.web3.utils.keccak256(encoded);
			console.trace(`hashed = ${hashed}`);

			let signature = this.web3.eth.accounts.sign(
    		hashed,
    		this.prvkey
			);

			console.trace(`signature = ${JSON.stringify(signature)}`);

			return signature;

		} catch(e){
			console.error(e);
			return false;
		}
	}
}