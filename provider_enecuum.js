let rsasign = require("jsrsasign");
let ContractParser = require("../node-dev/contractParser.js").ContractParser;
//let Utils = require("../node-dev/Utils.js")
let Network = require("./provider_abstract.js");
let http = require("http");
let request = require("request");
//let parser = require(`./dataParser.js`);
let crypto = require('crypto');
let zlib = require('zlib');

function ecdsa_sign(skey, msg) {
    var sig = new rsasign.Signature({ alg: "SHA256withECDSA" });
    let sigdata = { d: skey, curve: "secp256k1" };
    console.trace(`sigdata = ${JSON.stringify(sigdata)}`);
    sig.init(sigdata);

    sig.updateString(msg);
    return sig.sign();
}

let hash_tx_fields = function(tx){
    if (!tx)
        return undefined;
    let model = ['amount','data','from','nonce','ticker','to'];
    let str;
    try{
        str = model.map(v => crypto.createHash('sha256').update(tx[v].toString().toLowerCase()).digest('hex')).join("");
    }
    catch(e){
        if (e instanceof TypeError) {
            console.warn("Old tx format, skip new fields...");
            return undefined;
        }
    }
    return crypto.createHash('sha256').update(str).digest('hex');
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
                    resolve(data);
                } catch (e) {
                    reject(e);
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
        "lock" :                    0,
        "claim_init" :              0,
        "claim_confirm" :           0,
        "claim" :                   0
    },
};

module.exports = class EnecuumNetwork extends Network {
    constructor(network_config) {
        super(network_config);
        this.type = "enecuum";
        this.url = network_config.url;
        this.ticker = network_config.ticker;
        this.genesis_pubkey = network_config.genesis_pubkey;
        this.prvkey = network_config.prvkey;
        this.pubkey = network_config.pubkey;        

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
                let res = await http_get(url);
                status = res.status
            } catch (e) {
                await (new Promise(resolve => setTimeout(resolve, time)))
            }
        } while (status === null)
        return true
    }

    async read_tx (tx_hash) {
        let url = `${this.url}/api/v1/tx?hash=${tx_hash}`
        return await http_get(url)
    }
    
    async send_tx (type, parameters, model) { 
        if (!Object.keys(parameters).every((param) => model.indexOf(param) !== -1))
            throw new Error(`Invalid 'parameters' object`);

        let compressed_data = zlib.brotliCompressSync(JSON.stringify(parameters)).toString("base64");

        let parser = new ContractParser(config);
        let data = parser.dataFromObject({type, parameters:{compressed_data}});
        //let data = parser.dataFromObject({type, parameters});

        let tx = {
            amount : 1e8,
            from : this.pubkey,
            to : this.genesis_pubkey,
            data : data,
            nonce : Math.floor(Math.random() * 1e10),
            ticker : this.ticker
        };

        let hash = hash_tx_fields(tx);
        tx.sign = ecdsa_sign(this.prvkey, hash);

        try {
            console.trace(`Sending ${JSON.stringify(tx)}`);
            let res = await http_post(`${this.url}/api/v1/tx`, [tx]);
            console.trace(`tx post result = ${JSON.stringify(res)}`);
            if (res.err){
                console.error(res.message);
                return null;
            } else {
                return res.result[0].hash;
            }
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    async send_lock(params) {
        console.trace(`Sending lock with params ${JSON.stringify(params)} at ${this.caption}`);
        const model = [
            "dst_address",
            "dst_network",
            "amount",
            "hash"
        ];

        let args = {};

        args.dst_address = params.dst_address;
        args.dst_network = Number(params.dst_network);
        args.amount = params.amount.toString();
        args.hash = params.src_hash;

        try {
            console.trace(`args = ${JSON.stringify(args)}`);
            return await this.send_tx("lock", args, model);
        } catch(e){
            console.error(e);
            return null;
        }
    }

    encode_init_data(params){
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

        let type = "claim_init";

        let args = {};

        args = Object.assign(args, params.ticket);

        args.amount = args.amount.toString();
        args.transfer_id = params.transfer_id;
        args.dst_network = Number(args.dst_network);

        let parameters = args;

        if (!Object.keys(parameters).every((param) => model.indexOf(param) !== -1))
            throw new Error(`Invalid 'parameters' object`);

        let compressed_data = zlib.brotliCompressSync(JSON.stringify(parameters)).toString("base64");
        let parser = new ContractParser(config);
        let data = parser.dataFromObject({type, parameters:{compressed_data}});
        //let data = parser.dataFromObject({type, parameters});

        return data;
    }

    encode_confirm_data(params){
        const model = [
            "validator_id",
            "validator_sign",
            "transfer_id",
        ];

        let type = "claim_confirm";

        let args = {};

        args.validator_id = params.validator_id;
        args.validator_sign = params.validator_sign;
        args.transfer_id = params.transfer_id;

        let parameters = args;

        if (!Object.keys(parameters).every((param) => model.indexOf(param) !== -1))
            throw new Error(`Invalid 'parameters' object`);

        let compressed_data = zlib.brotliCompressSync(JSON.stringify(parameters)).toString("base64");
        let parser = new ContractParser(config);
        let data = parser.dataFromObject({type, parameters:{compressed_data}});
        //let data = parser.dataFromObject({type, parameters});

        return data;
    }
    
    async send_claim_init(params) {
        console.trace(`Sending claim with params ${JSON.stringify(params/*, null, "\t"*/)} at ${this.caption}`);
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

        let args = {};

        args = Object.assign(args, params.ticket);

        args.amount = args.amount.toString();
        args.transfer_id = params.transfer_id;
        args.dst_network = Number(args.dst_network);

        console.trace(`args = ${JSON.stringify(args)}`);

        try {
            let compressed_data = this.encode_init_data(params);
            //return await this.send_tx("claim_init", {compressed_data}, ["compressed_data"]);
            return await this.send_tx("claim_init", args, model);
        } catch(e){
            console.error(e);
            return null;
        }
    }

    async send_claim_confirm(params, prvkey) {
        console.trace(`Sending claim_confirm with params ${JSON.stringify(params)} at ${this.caption}`);
        const model = [
            "validator_id",
            "validator_sign",
            "transfer_id",
        ];

        let args = {};

        args.validator_id = params.validator_id;
        args.validator_sign = params.validator_sign;
        args.transfer_id = params.transfer_id;

        try {
            return await this.send_tx("claim_confirm", args, model);
        } catch(e){
            console.error(e);
            return null;
        }
    }

    async wait_lock(tx_hash) {
        console.trace(`Waiting for lock transaction ${tx_hash} at ${this.caption}`);
        
        try {
            let url = `${this.url}/api/v1/tx?hash=${tx_hash}`;            
            let response = await http_get(url);

            response = JSON.parse(response);
            if (response.status === 3){
                return true;
            } else {
                return false;
            }
        } catch(e){
            return false;
        }
    }
    
    async wait_claim(tx_hash) {
        console.trace(`Waiting for transaction ${tx_hash} at ${this.caption}`);
        
        try {
            let url = `${this.url}/api/v1/tx?hash=${tx_hash}`;

            let response = await http_get(url);
            response = JSON.parse(response);
            if (response.status === 3){
                return true;
            } else {
                return false;
            }
        } catch(e){
            return false;
        }
    }

    async read_claim(tx_hash) {
        console.trace(`Reading claim transaction ${tx_hash} at ${this.caption}`);

        try {
            let url = `${this.url}/api/v1/tx?hash=${tx_hash}`;

            let tx_info = await http_get(url);
            tx_info = JSON.parse(tx_info);
            if (tx_info.status === 3){
                let parser = new ContractParser(config);
                let parsed_data = parser.parse(tx_info.data);                
                return parsed_data.parameters;
            } else {
                console.error(`Bad tx status`);
                return null;
            }
        } catch(e){
            console.error(e);
            return null;
        }
    }
    
    async read_lock(tx_hash) {
        console.trace(`Reading state lock for hash ${tx_hash} at ${this.caption}`);

        try{
            let url = `${this.url}/api/v1/tx?hash=${tx_hash}`;
            let tx_info = await http_get(url);
            tx_info = JSON.parse(tx_info);
            console.trace(tx_info);

            let parser = new ContractParser(config);

            let params = parser.parse(tx_info.data);

            console.trace(JSON.stringify(params));

            let decompressed = zlib.brotliDecompressSync(Buffer.from(params.parameters.compressed_data, 'base64'));
            console.trace(`decompressed = ${decompressed}`);
            decompressed = JSON.parse(decompressed);


            if (params.type === 'lock'){
                let dst_address = decompressed.dst_address;
                let dst_network = decompressed.dst_network;
                let amount = decompressed.amount;
                let src_hash = decompressed.hash;
                let src_address = tx_info.from;

                let result = { dst_address, dst_network, amount, src_hash, src_address };

                console.trace(`result = ${JSON.stringify(result)}`);

                return result;
            } else {
                throw `Wrong smart contract type - ${params.type}`;
            }
        } catch(e) {
            console.error(e);
            return null;
        }
    }

    async read_state(url) {
        console.trace(`Reading state of contract ${this.contract_address} at ${this.caption}`);

        let network_id, minted;

        try {
            network_id = await this.get_network_id(url);
        } catch(e){
            console.error(e);
        }

        try {
            minted = await this.get_minted_tokens(url);
        } catch(e){
            minted = [];
            console.error(e);
        }

        return { network_id, minted };
    }

    async read_transfers (src_address, src_hash, src_network, dst_address) {
        console.trace(`Extracting transfers for src_address=${src_address} & src_hash=${src_hash} & src_network=${src_network} & dst_address=${dst_address} at ${this.caption}`);

        try {
            let url = `${this.url}/api/v1/transfers?dst_address=${dst_address}&src_address=${src_address}&src_network=${src_network}&src_hash=${src_hash}`;
            console.trace(`url = ${url}`);
            let response = await http_get(url);

            console.trace(`response = '${response}'`);

            let result = JSON.parse(response);

            if (!Array.isArray(result)){
                console.warn(`get ${url} returned wrong response - array expected`);
                return null;
            }

            if (result.length < 2){
                return result;
            } else {
                console.warn(`result should be empty or single-element array`)
                return null;
            }
        } catch(e){
            console.warn(e);
            return null;
        }
    }

    async get_network_id (url=this.url) {
        console.trace(`Reading enecuum network id at ${url}`);
        let net_id = await http_get(`${url}/api/v1/network_id`);
        return Number(net_id);
    }

    async get_minted_tokens (url=this.url) {
        console.trace(`Reading minted tokens at ${url}`)
        let minted_tokens = await http_get(`${url}/api/v1/minted_token`);
        return JSON.parse(minted_tokens);
    }

    async get_balance (address, token){
        console.trace(`Reading account ${address} at ${this.caption}`);
		try {
            //let url = `${this.url}/api/v1/balance?id=${address}&token=${token}`;
            let url = `${this.url}/api/v1/balance_all?id=${address}`;
            console.trace(`url = ${url}`);
            let response = await http_get(url);
            response = JSON.parse(response);
            console.trace(`response = ${JSON.stringify(response)}`);

            let result = {};
            response.forEach(t => {
                result[t.token] = t.amount;
            });
			return result;
		} catch(e) {
			console.error(e);
			return null;
		}
    }

    async get_token_info(hash){
        console.trace(`Reading token_info for ${hash} at ${this.caption}`);

        try {
            let response = await http_get(`${this.url}/api/v1/token_info?hash=${hash}`);
            console.trace(`response = ${response}`);
            response = JSON.parse(response);
            if (response.length === 1){
                let result = {};
                result.decimals = response[0].decimals;
                result.ticker = response[0].ticker;
                
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

    create_ticker_from(origin_ticker){
        console.trace(`Creating new ticker from string ${origin_ticker}`);
        let result = origin_ticker.substring(0, 4);
        return result;
    }

    sign(msg) {
        console.trace(`signing ${msg}`);
        return ecdsa_sign(this.prvkey, msg);
    }
};
