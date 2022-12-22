let Network = require('./provider_abstract.js');

let http = require('http');
let request = require('request');
let rsasign = require('jsrsasign');

function ecdsa_sign(skey, msg){
        var sig = new rsasign.Signature({ "alg": 'SHA256withECDSA' });
        let sigdata = { d: skey, curve: 'secp256k1' };
        console.trace(`sigdata = ${JSON.stringify(sigdata)}`);
        sig.init(sigdata);

        sig.updateString(msg);
        return sig.sign();
}

let http_get = function(url){
                return new Promise(function (resolve, reject) {
                        let req = http.get(url, function (res) {
                                let data = "";

                                res.on('data', function (chunk){
                                        data += chunk;
                                });

                                res.on('end', function () {
                                        try {
                                                resolve(JSON.parse(data));
                                        } catch (e) {
                                                reject();
                                        }
                                })
                        });

                        req.on('error', function (err){
                                reject(err);
                        });
                });
        };

let http_post = function(url, json){
        return new Promise(function(resolve, reject){
                request({url, method:"POST", json}, function(err, resp, body){
                    if (err){
                        reject();
                    } else {
                    	//console.log(body);
                        resolve(body);
                    }
            });
        });
};

module.exports = class TestNetwork extends Network{
	constructor(network_config){
		super(network_config);
		this.type = "test";
		this.url = network_config.url;
		this.wrapper_prefix = network_config.wrapper_prefix === undefined ? "wr" : network_config.wrapper_prefix;

		if (network_config.type !== this.type){
			console.fatal(`Network config initialization failed due type mismatch: ${this.type} required instead ${network_config.type}`);
		}
	}

	async send_lock(params){
		console.trace(`Sending lock with params ${JSON.stringify(params)} at ${this.caption}`);

		try {
			let hash = (await http_post(`${this.url}/api/v1/lock`, params)).result.hash;
			return hash;
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async send_claim_init(params){
		console.trace(`Sending claim with params ${JSON.stringify(params)} at ${this.caption}`);

		try {
			let hash = (await http_post(`${this.url}/api/v1/claim`, params)).result.hash;
			return hash;
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async send_claim_confirm(params){
		console.trace(`Sending idle`);
		return 0;
	}

	async get_balance(address, hash){
		console.trace(`Reading account ${address} at ${this.caption}`);

		try {
			let response = await http_get(`${this.url}/api/v1/account?address=${address}&hash=${hash}`);
			if (response.err === 0){
				return response.result;
			} else {
				console.error(`failed to get account data`);
				return null;
			}
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async get_token_info(hash){
		console.trace(`Reading token_info for ${hash} at ${this.caption}`);

		try {
			let response = await http_get(`${this.url}/api/v1/token_info?hash=${hash}`);
			if (response.err === 0){
				let result = {};
				result.decimals = response.result.decimals;
				result.ticker = response.result.ticker;

				return result;
			} else {
				console.error(`failed to get token data`);
				return null;
			}
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async wait_lock(tx_hash){
		console.trace(`Waiting for lock transaction ${tx_hash} at ${this.caption}`);
		try {
			let url = `${this.url}/api/v1/read_transaction?hash=${tx_hash}`;
			let response = await http_get(url);

			if (response.err !== 0){
				return false;
			} else {
				return true;
			}
		} catch(e){
			return false;
		}
	}

	async wait_claim(tx_hash){
		console.trace(`Waiting for claim transaction ${tx_hash} at ${this.caption}`);

		if (tx_hash === 0)
			return true;

		try {
			let url = `${this.url}/api/v1/read_transaction?hash=${tx_hash}`;
			let response = await http_get(url);

			if (response.err !== 0){
				return false;
			} else {
				return true;
			}
		} catch(e){
			return false;
		}
	}

	async read_lock(tx_hash){
		console.trace(`Extracting lock_data for ${tx_hash} at ${this.caption}`);

		try {
			let url = `${this.url}/api/v1/read_transaction?hash=${tx_hash}`;
			let response = await http_get(url);

			if (response.err !== 0){
				console.error(`err!==0`);
				return null;
			} else {
				let {dst_address, dst_network, amount, src_hash, src_address} = response.result;
				if (dst_address && dst_network && amount && src_hash && src_address) {
					let tokens = await http_get(`${this.url}/api/v1/tokens`);
					let ticker = tokens.filter((t) => {return t.hash === src_hash})[0].ticker;
					console.trace(`tokens = ${JSON.stringify(tokens)}`);

					return {dst_address, dst_network, amount, src_hash, src_address, ticker};
				} else {
					console.error(`failed to parse ${JSON.stringify(response.result)}`);
					return null;					
				}
			}
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async read_claim(tx_hash){
		console.trace(`Extracting claim_data for ${tx_hash} at ${this.caption}`);

		try {
			let url = `${this.url}/api/v1/read_transaction?hash=${tx_hash}`;
			let response = await http_get(url);

			if (response.err !== 0){
				return null;
			} else {
				let {dst_hash} = response.result;
				if (dst_hash) {
					return {dst_hash};
				} else {
					return null;
				}
			}
		} catch(e){
			return null;
		}
	}

	async read_transfers(src_address, src_hash, src_network, dst_address){
		console.trace(`Extracting transfers for src_address=${src_address} & src_hash=${src_hash} & src_network=${src_network} & dst_address=${dst_address} at ${this.caption}`);

		try {
			let url = `${this.url}/api/v1/transfers?src_address=${src_address}&src_hash=${src_hash}&src_network=${src_network}&dst_address=${dst_address}`;
			let response = await http_get(url);

			if (response.err !== 0){
				return null;
			} else {
				if (response.result.length < 2){
					return response.result;
				} else {
					console.warn(`result should be empty or single-element array`)
					return null;
				}
			}
		} catch(e){
			console.warn(e);
			return null;
		}
	}

	async read_state(){
		console.trace(`Reading state of contract ${this.contract_address} at ${this.caption}`);

		let network_id = null;
		try {
			network_id = (await http_get(`${this.url}/api/v1/network_id`)).network_id;
		} catch(e){
			console.error(e);			
		}

		let minted = null;
		try {
			minted = await http_get(`${this.url}/api/v1/minted`);
		} catch(e){
			console.error(e);
		}

		let known_networks = null;
		try {
			known_networks = await http_get(`${this.url}/api/v1/known_networks`);
		} catch(e){
			console.error(e);
		}

 		return {network_id, minted, known_networks};
	}

	create_ticker_from(origin_ticker){
		console.trace(`Creating new ticker from string ${origin_ticker}`);
		let result = origin_ticker.substring(0, 3);
		return result;
	}

	sign(msg){
		console.trace(`signing ${msg}`);
		//return ecdsa_sign(this.prvkey, msg);
		return `${msg}.${this.prvkey}`;
	}
}