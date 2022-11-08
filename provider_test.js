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

		if (network_config.type !== this.type){
			console.fatal(`Network config initialization failed due type mismatch: ${this.type} required instead ${network_config.type}`);
		}
	}

	async send_lock(params){
		console.trace(`Requesting lock with params ${params} at ${this.caption}`);

		try {
			let hash = (await http_post(`${this.url}/api/v1/lock`, params)).result.hash;
			return hash;
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async send_claim(params){
		console.trace(`Requesting claim with params ${params} at ${this.caption}`);

		try {
			let hash = (await http_post(`${this.url}/api/v1/claim`, params)).result.hash;
			return hash;
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async read_account(address){
		console.trace(`Reading account ${address} at ${this.caption}`);

		try {
			let response = await http_get(`${this.url}/api/v1/account?address=${address}`);
			if (response.err === 0){
				return response.result.account;
			} else {
				console.error(`failed to get account data`);
				return null;
			}
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async read_lock(tx_hash){
		console.trace(`Extracting lock_data for ${tx_hash} at ${this.caption}`);

		try {
			let url = `${this.url}/api/v1/read_lock?hash=${tx_hash}`;
			let response = await http_get(url);

			if (response.err !== 0){
				return null;
			} else {
				let {dst_address, dst_network, amount, src_hash, src_address, ticker} = response.result;
				if (dst_address) {
					let tokens = await http_get(`${this.url}/api/v1/tokens`);
					let ticker = tokens.filter((t) => {return t.hash === src_hash})[0];
					console.trace(`tokens = ${tokens}`);

					return {dst_address, dst_network, amount, src_hash, src_address, ticker};
				} else {
					return null;
				}
			}

		} catch(e){
			return null;
		}
	}

	async read_transfers(){
		return [];
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

 		return {network_id, minted};
	}

	sign(msg){
		console.trace(`signing ${msg}`);
		//return ecdsa_sign(this.prvkey, msg);
		return `${msg}.${this.prvkey}`;
	}
}