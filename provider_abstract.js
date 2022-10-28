module.exports = class Network {
	constructor(network_config){
		this.caption = network_config.caption;
		this.contract_address = network_config.contract_address;
		this.pubkey = network_config.pubkey;
		this.prvkey = network_config.prvkey;
	}
}