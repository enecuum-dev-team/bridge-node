let rsasign = require('jsrsasign');
let ContractParser = require('./contractParser.js').ContractParser;
let Network = require('./provider_abstract.js');
let http = require('http');

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
                        	console.trace(`error`);
                                reject(err);
                        });
                });
        };

let config = {
	contract_pricelist : {
        "create_token" :    20000000000,
        "create_pos" :      0,
        "delegate" :        0,
        "undelegate" :      0,
        "transfer" :        0,
        "pos_reward" :      0,
        "mint" :            0,
        "burn" :            0,
        "custom" :          20000000000,
        "pool_create" :     0,
        "pool_add_liquidity" :      0,
        "pool_remove_liquidity" :   0,
        "pool_sell_exact" :         0,
        "farm_create" :             0,
        "farm_get_reward" :         0,
        "farm_increase_stake" :     0,
        "farm_decrease_stake" :     0,
        "farm_close_stake" :        0,
        "farm_add_emission" :       0,
        "dex_cmd_distribute" :      0,
        "pool_sell_exact_routed" :  0,
        "pool_buy_exact" :          0,
        "pool_buy_exact_routed" :   0,
        "token_send_over_bridge" :  "0",
        "claim_init" :              "0",
        "claim_confirm" :           "0",
        "claim" :                   "0"
    }
  };

module.exports = class EnecuumNetwork extends Network{
	constructor(network_config){
		super(network_config);
		this.type = "enecuum";
		this.url = network_config.url;

		if (network_config.type !== this.type){
			console.fatal(`Network config initialization failed due type mismatch: ${this.type} required instead ${network_config.type}`);
		}
	}

	async read_lock(tx_hash){
		let url = `${this.url}/api/v1/tx?hash=${tx_hash}`;
		let tx_info = await http_get(url);
		console.debug(tx_info);

		let parser = new ContractParser(config);

		let params = parser.parse(tx_info.data);

		console.trace(params);

		let dst_address = params.dst_address;
		let dst_network = params.dst_network;
		let amount = params.amount;
		let src_hash = params.src_hash;
		let src_address = params.src_address;

		return {dst_address, dst_network, amount, src_hash, src_address};
	}

	async read_transfers(){
		return [];
	}

	async read_state(){
		console.trace(`Reading state of contract ${this.contract_address} at ${this.caption}`);

		let network_id = "1";
		let minted = [];

 		return {network_id, minted};
	}

	sign(msg){
		console.trace(`signing ${msg}`);
		return ecdsa_sign(this.prvkey, msg);
	}
}