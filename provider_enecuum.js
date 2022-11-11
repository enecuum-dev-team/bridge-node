let rsasign = require("jsrsasign");
let ContractParser = require("../node-dev/contractParser").ContractParser;
let Utils = require("../node-dev/Utils")
let Network = require("./provider_abstract.js");
let http = require("http");
let request = require("request");

function ecdsa_sign(skey, msg) {
    var sig = new rsasign.Signature({ alg: "SHA256withECDSA" });
    let sigdata = { d: skey, curve: "secp256k1" };
    console.trace(`sigdata = ${JSON.stringify(sigdata)}`);
    sig.init(sigdata);

    sig.updateString(msg);
    return sig.sign();
}

let http_get = function (url) {
    return new Promise(function (resolve, reject) {
        let req = http.get(url, function (res) {
            let data = "";

            res.on("data", function (chunk) {
                data += chunk;
            });

            res.on("end", function () {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject();
                }
            });
        });

        req.on("error", function (err) {
            console.trace(`error`);
            reject(err);
        });
    });
};

let http_post = function (url, json) {
    return new Promise(function (resolve, reject) {
        request({ url, method: "POST", json }, function (err, resp, body) {
            if (err) {
                reject();
            } else {
                //console.log(body);
                resolve(body);
            }
        });
    });
};

let config = {
    contract_pricelist: {
        create_token: 20000000000,
        create_pos: 0,
        delegate: 0,
        undelegate: 0,
        transfer: 0,
        pos_reward: 0,
        mint: 0,
        burn: 0,
        custom: 20000000000,
        pool_create: 0,
        pool_add_liquidity: 0,
        pool_remove_liquidity: 0,
        pool_sell_exact: 0,
        farm_create: 0,
        farm_get_reward: 0,
        farm_increase_stake: 0,
        farm_decrease_stake: 0,
        farm_close_stake: 0,
        farm_add_emission: 0,
        dex_cmd_distribute: 0,
        pool_sell_exact_routed: 0,
        pool_buy_exact: 0,
        pool_buy_exact_routed: 0,
        token_send_over_bridge: 0,
        claim_init: 0,
        claim_confirm: 0,
        claim: 0,
    },
};

module.exports = class EnecuumNetwork extends Network {
    constructor(network_config) {
        super(network_config);
        this.type = "enecuum";
        this.url = network_config.url;
        this.ticker = network_config.ticker;
        this.genesis = network_config.genesis;

        if (network_config.type !== this.type) {
            console.fatal(
                `Network config initialization failed due type mismatch: ${this.type} required instead ${network_config.type}`
            );
        }
    }

    async wait_tx (tx_hash, time=1000) {
        let url = `${this.url}/api/v1/tx?hash=${tx_hash}`;
        let status = null;
        do {
            try {
                status = await http_get(url).status;
            } catch (e) {
                await (new Promise(resolve => setTimeout(resolve, time)))
            }
        } while (status === null)
        return true
    }
    
    async send_tx (type, parameters, model, prvkey) { 
        if (Object.keys(parameters).every((param) => model.indexOf(param) !== -1))
            throw new Error(`Invalid 'parameters' object`);
        let parser = new ContractParser(config)
        let data = parser.dataFromObject({type, parameters})
        let tx = {
            amount : 1e8,
            from : parameters.dst_address,
            to : this.genesis.pubkey,
            data : data,
            nonce : Math.floor(Math.random() * 1e10),
            ticker : this.ticker
        }
        let hash = Utils.hash_tx_fields(tx)
        tx.sign = Utils.ecdsa_sign(prvkey, hash)
        try {
            let status = (await http_post(`${this.url}/api/v1/tx`, [tx])).status;
            return status === 0;
        } catch (error) {
            console.log(error);
            return null;
        }
    }

    async send_lock(params, prvkey) {
        console.trace(`Sending lock with params ${JSON.stringify(params, null, "\t")} at ${this.caption}`);
        const model = [
            "dst_address",
            "dst_network",
            "amount",
            "hash"
        ];
        await this.send_tx("token_send_over_bridge", params, model, prvkey);
    }
    
    async send_claim(params, prvkey) {
        console.trace(`Sending claim with params ${JSON.stringify(params, null, "\t")} at ${this.caption}`);
        const model = [
            "dst_address",
            "dst_network",
            "amount",
            "src_hash",
            "src_address",
            "src_network",
            "origin_hash",
            "origin_network",
            "nonce",
            "transfer_id",
            "ticker",
        ];
        await this.send_tx("claim_init", params, model, prvkey);
    }

    async wait_lock(tx_hash, time) {
        console.trace(`Waiting for lock transaction ${tx_hash} at ${this.caption}`);
        return await this.wait_tx(tx_hash, time)
    }
    
    async wait_claim(tx_hash, time) {
        console.trace(`Waiting for claim transaction ${tx_hash} at ${this.caption}`);
        return await this.wait_tx(tx_hash, time)
    }
    
    async read_lock(tx_hash) {
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

        return { dst_address, dst_network, amount, src_hash, src_address };
    }

    async read_transfers() {
        return [];
    }

    async read_state() {
        console.trace(
            `Reading state of contract ${this.contract_address} at ${this.caption}`
        );

        let network_id = "1";
        let minted = [];

        return { network_id, minted };
    }

    async read_account (address, token, url=this.url){
        console.trace(`Reading account ${address} at ${this.caption}`);
		try {
            let response = await http_get(`${url}/api/v1/balance?id=${address}${token ? `&${token}` : ""}`);
			return response.amount;
		} catch(e) {
			console.error(e);
			return null;
		}
    }

    sign(msg) {
        console.trace(`signing ${msg}`);
        return ecdsa_sign(this.prvkey, msg);
    }
};
