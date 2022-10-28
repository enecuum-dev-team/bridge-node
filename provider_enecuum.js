let rsasign = require('jsrsasign');

let Network = require('./provider_abstract.js');

function ecdsa_sign(skey, msg){
        var sig = new rsasign.Signature({ "alg": 'SHA256withECDSA' });
        sig.init({ d: skey, curve: 'secp256k1' });
        sig.updateString(msg);
        return sig.sign();
}

module.exports = class EnecuumNetwork extends Network{
	constructor(network_config){
		super(network_config);
		this.type = "enecuum";

		if (network_config.type !== this.type){
			console.fatal(`Network config initialization failed due type mismatch: ${this.type} required instead ${network_config.type}`);
		}
	}

	async read_transfers(){
		return [];
	}

	async read_state(){
		console.trace(`Reading state of contract ${this.contract_address} at ${this.caption}`);

		let network_id = "7";
		let minted = [];

 		return {network_id, minted};
	}

	async sign(msg){
		console.trace(`signing ${msg}`);
		return ecdsa_sign(this.prvkey, msg);
	}
}