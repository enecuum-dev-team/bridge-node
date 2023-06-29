const request = require('request');
const crypto = require('crypto');
const rsasign = require('jsrsasign');
let ContractParser = require("../node-dev/contractParser.js").ContractParser;

let parser_config = {
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

let bit_config = {
    url : "95.216.246.116",
    rich : {
            "prvkey": "...",
            "pubkey": "..."
    },
    bob : {
            "prvkey": "...",
            "pubkey": "..."
    },
    ticker : "0000000000000000000000000000000000000000000000000000000000000001",
    genesis : {
    	"pubkey":"029dd222eeddd5c3340e8d46ae0a22e2c8e301bfee4903bcf8c899766c8ceb3a7d"
    }
};

let config = bit_config;

let post = function(url, data){
    return new Promise(function(resolve, reject){
        request({url, method:"POST", json:data}, function(err, resp, body){
            if (err){
                console.error(`Failed to send transaction`);
                reject();
            } else {
                try {
	                resolve(body);
                } catch (e){
                    reject(e);
                }
            }
        });
    })
};

let sleep = function(ms){
        return new Promise(function(resolve, reject){
                setTimeout(() => resolve(), ms)
        });
};

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

let ecdsa_sign = function(skey, msg){
	let sig = new rsasign.Signature({ "alg": 'SHA256withECDSA' });
	try {
		sig.init({ d: skey, curve: 'secp256k1' });
		sig.updateString(msg);
		return sig.sign();
	}
	catch(err){
		console.error("Signing error: ", err);
		return null;
	}
}

let send_tx = async function(calldata){
	let data = calldata;
	let from = config.rich.pubkey;
	let to = config.genesis.pubkey;
	let amount = 1e9;
	let nonce = Math.floor(Math.random() * 1e10);
	let ticker = config.ticker;

	let tx = {amount, from, data, nonce, ticker, to};

	let hash = hash_tx_fields(tx);
	tx.sign = ecdsa_sign(config.rich.prvkey, hash);

	//console.log(tx);

	let ip = config.url;
	let send_result = await post(`http://${ip}/api/v1/tx`, [tx]);
	console.log(send_result);	
	return send_result;
}


let check = function(hash){
        return new Promise(function(resolve, reject){
                request(`http://${config.url}/api/v1/tx?hash=${hash}`, {json:true}, function(err, resp, body){
                        if (err){
                                console.error(`Failed to check transaction`);
                                reject();
                        } else {
                                if (body === undefined){
                                        reject();
                                } else {
                                        //console.log(`Transaction found, status = ${body.status}`);
                                        resolve();
                                }
                        }
                });
        });
};

let distribute = async function(params){

	let {to, ticker} = params;

	let amount = 1e10;
	let data = "";
	let from = config.rich.pubkey;
	let nonce = Math.floor(Math.random() * 1e10);

	let tx = {amount, data, from, nonce, ticker, to};

	let hash = hash_tx_fields(tx);
	console.log(hash);
	tx.sign = ecdsa_sign(config.rich.prvkey, hash);

	console.log(tx);

	let ip = config.url;
	let send_result = await post(`http://${ip}/api/v1/tx`, [tx]);
	console.log(send_result);	
}

let enq_create_token = async function(){
	let create_call = {
		type: 'create_token',
		parameters:{
			fee_type: 0,
			fee_value: BigInt(1),
			ticker: 'KLB',
			decimals: BigInt(3),
			total_supply: BigInt(10000000000000),
			name: 'KOLOBOK'
		}
	};

	//let ContractParser = require('./contractParser.js').ContractParser;
	let parser = new ContractParser(parser_config);

	let init_data = parser.dataFromObject(create_call);

	let response = await send_tx(init_data);
	//console.log(`https://bit.enecuum.com/#!/token/${hash}`);
	return response.result[0].hash;
}

let create_and_distibute = async function(){
	let hash = await enq_create_token();
	console.log(`hash = ${hash}`);

    let executed = false;

    let delay_s = 0;

    do {
            process.stdout.write(`.`);
            try {
                let status = await check(hash);
                executed = true;
                failed_txs_count = 0;
            } catch(e){
                delay_s++;
                await sleep(1000);
            }
    } while(!executed);

	distribute({ticker:hash, to:'03c779767d6715be1759c718b39d9f1d0baf415f8a6417841d5a4acdb074658566'});
}

create_and_distibute();
