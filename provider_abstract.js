module.exports = class Network {
	constructor(network_config){
		this.caption = network_config.caption;
		this.contract_address = network_config.contract_address;
		this.pubkey = network_config.pubkey;
		this.prvkey = network_config.prvkey;
	}

	calculate_ticket_hash(ticket){
		let param_names = ["dst_address", "dst_network", "amount", "src_hash", "src_address", "src_network", "origin_hash", "origin_network", "nonce", "ticker"];

		let params_str = param_names.map(v => crypto.createHash('sha256').update(ticket[v].toString().toLowerCase()).digest('hex')).join("");

		let ticket_hash = crypto.createHash('sha256').update(params_str).digest('hex');

		return ticket_hash;
	}
}