let assert = require('assert');
let request = require('request');
let argv = require('yargs').argv;
let fs = require('fs');

let EthereumNetwork = require('../provider_ethereum.js');
let EnecuumNetwork = require('../provider_enecuum.js');
let TestNetwork = require('../provider_test.js');

console.silly = function (...msg) {console.log(`\x1b[35m%s\x1b[0m`, ...msg);};
console.trace = function (...msg) {console.log(`\x1b[36m\x1b[1m%s\x1b[0m`, ...msg);};
console.debug = function (...msg) {console.log(`\x1b[37m%s\x1b[0m`, ...msg);};
console.info = function (...msg) {console.log(`\x1b[37m\x1b[1m%s\x1b[0m`, ...msg);};
console.warn = function (...msg) {console.log(`\x1b[33m%s\x1b[0m`, ...msg);};
console.error = function (...msg) {console.log(`\x1b[31m\x1b[1m%s\x1b[0m`, ...msg);};
console.fatal = function (...msg) {
  console.log(`\x1b[31m%s\x1b[0m`, ...msg);
  process.exit(1);
};
require('console-stamp')(console, {datePrefix: '[', pattern:'yyyy.mm.dd HH:MM:ss', level: 'silly', extend:{fatal:0, debug:4, trace:5, silly:6}, include:['silly', 'trace','debug','info','warn','error','fatal']});

const CONFIG_FILENAME = `config.json`;
let config = {
  tx_confirmation_delay_ms: 60000,
  validators : [{url:"http://localhost:8080/api/v1/notify"}],

  england: {"url" : "http://localhost:8017", "type" : "test", "caption" : "test_1"},
  pound: "1704",
  alice_pubkey: "1702",

  mexico: {"url" : "http://localhost:8023", "type" : "test", "caption" : "test_2"},
  peso: "230001",
  jose_pubkey: "2301",

  germany: {"url" : "http://localhost:8029", "type" : "test", "caption" : "test_3"},
  mark: "290001",
  hans_pubkey: "2901"
};

console.info("Application started");

let config_filename = argv.config || CONFIG_FILENAME;

console.info('Loading config from', config_filename, '...');

let cfg = {};
try {
  let content = fs.readFileSync(config_filename, 'utf8');
  cfg = JSON.parse(content);
  config = Object.assign(config, cfg);
} catch (e) {
  console.info(`Failed to load config - ${JSON.stringify(e)}`);
}

config = Object.assign(config, argv);

console.info(`config = ${JSON.stringify(config)}`);

let init_network = function(params){
  console.info(`Initializing provider ${JSON.stringify(params)}`);
  let network = {};

  switch(params.type){
    case 'ethereum':
      network.provider = new EthereumNetwork(params);
      break;
    case 'enecuum':
      network.provider = new EnecuumNetwork(params);
      break;
    case 'test':
      network.provider = new TestNetwork(params);
      break;
    default:
      console.fatal(`Unknown network type - ${params.type}`)
  }
  return network;
}

let get_decimals = async function(network, hash){
  console.info(`Reading decimals for ${hash} at ${network.caption}`);
  let token_info = await network.provider.get_token_info(hash);
  let decimals = token_info.decimals;
  console.info(`decimals = ${decimals}`);

  return decimals;
}

const POUND = config.pound;
const PESO = config.peso;
const MARK = config.mark;

const ALICE_PUBKEY = config.alice_pubkey;
const JOSE_PUBKEY = config.jose_pubkey;
const HANS_PUBKEY = config.hans_pubkey;

let ENGLAND = init_network(config.england);
let MEXICO = init_network(config.mexico);
let GERMANY = init_network(config.germany);

let POUND_DECIMALS;// = get_decimals(ENGLAND, POUND);
let PESO_DECIMALS;// = get_decimals(MEXICO, PESO);
let MARK_DECIMALS;// = get_decimals(GERMANY, MARK);

let sleep = function(ms){
        return new Promise(function(resolve, reject){
                setTimeout(() => resolve(), ms)
        });
};

let wait_for = async function(method, args, condition, timeout_ms){
  let result;

  let start = new Date();
  //let span = timeout_ms;

  let span;
  do {
    response = await method(...args);

    if (condition(response)){
      return response;
    } else {
      await sleep(1000);
    }

    now = new Date();
    span = now - start;
  } while (span < timeout_ms);

  console.warn('wait timeout reached');

  return null;
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

let balance_diff = function(old_balance, new_balance, exclude = []){
  let diff = {};
    for (let n in new_balance){
      if (exclude.every(h => h !== n)){
        let f = false;
        for (let o in old_balance)
          if (n === o){
            f = true;
            if (old_balance[n] !== new_balance[n])
              diff[n] = new_balance[n] - old_balance[n];
          }
        
        if (!f){
  //        console.log(`updating diff ${n} with ${new_balance[n]}`);
          diff[n] = new_balance[n];
        }
      }
    }
    return diff;
}

let simple_bridge = async function(src_network_obj, src_address, src_hash, amount, dst_network_obj, dst_address){
    let src_provider = src_network_obj.provider;
    let dst_provider = dst_network_obj.provider;
    let src_network = src_network_obj.id;
    let dst_network = dst_network_obj.id;


    console.debug(`Checking balance of ${src_address} at ${src_network}`);
    let old_sender = await src_provider.get_balance(src_address, src_hash);
    console.info(`old sender = ${JSON.stringify(old_sender)}`);

    console.debug('Alice sending transaction...')
    let lock_hash = await src_provider.send_lock({dst_address, dst_network, amount, src_hash, src_address});
    assert(lock_hash !== null, 'Failed to send lock transaction');

    console.debug(`Waiting for approve of ${lock_hash}`);
    let lock_result = await wait_for(src_provider.wait_lock.bind(src_provider), [lock_hash], (r) => {return r === true}, config.tx_confirmation_delay_ms);
    assert(lock_result !== null, 'Failed to approve lock');

    console.debug(`Reading lock data of ${lock_hash}`);
    let lock_data = await src_provider.read_lock(lock_hash);
    assert(lock_data !== null, `Lock data must be not null`);

    console.debug(`Checking balance of ${src_address} at ${src_network}`);
    let new_sender = await src_provider.get_balance(src_address, src_hash);
    console.info(`new sender = ${JSON.stringify(new_sender)}`);

    let sender_diff = balance_diff(old_sender, new_sender);
    console.info(`sender_diff = ${JSON.stringify(sender_diff)}`);
    assert(BigInt(sender_diff[src_hash]) === BigInt(-1 * amount), `Sender amount must decrease`);

    console.debug(`Quering validator with hash ${lock_hash}`);
    let ticket = await http_post(config.validators[0].url, {networkId : src_network, txHash : lock_hash});
    assert(ticket.err === undefined, `Validator denied to confirm lock, ticket = ${JSON.stringify(ticket)}`);

    console.debug(`Checking balance of ${dst_address} at ${dst_network}`);
    let old_receiver = await dst_provider.get_balance(dst_address);
    console.info(`old receiver = ${JSON.stringify(old_receiver)}`);

    console.debug(`Claim init ${JSON.stringify(ticket)} at ${dst_network}`);
    let claim_init_hash = await dst_provider.send_claim_init(ticket);
    assert(claim_init_hash !== null, 'Failed to send claim init transaction');

    console.debug(`Waiting for approve of claim init ${claim_init_hash}`);
    let claim_init_result = await wait_for(dst_provider.wait_claim.bind(dst_provider), [claim_init_hash], (r) => {return r === true}, config.tx_confirmation_delay_ms);
    assert(claim_init_result !== null, 'Failed to approve claim init');

    console.debug(`Claim confirm ${JSON.stringify(ticket)} at ${dst_network}`);
    let claim_confirm_hash = await dst_provider.send_claim_confirm(ticket, claim_init_hash);
    assert(claim_confirm_hash !== null, 'Failed to send claim confirm transaction');

    console.debug(`Waiting for approve of claim confirm ${claim_confirm_hash}`);
    let claim_confirm_result = await wait_for(dst_provider.wait_claim.bind(dst_provider), [claim_confirm_hash], (r) => {return r === true}, config.tx_confirmation_delay_ms);
    assert(claim_confirm_result !== null, 'Failed to approve claim confirm');

    console.debug(`Parsing claim ${claim_init_hash}`);
    let claim_data = await dst_provider.read_claim(claim_init_hash);
    console.info(`Claim data = ${JSON.stringify(claim_data)}`);
    assert(claim_data.dst_hash !== null, 'Failed to verify claim data');

    console.debug(`Checking balance of ${dst_address} at ${dst_network}`);
    let new_receiver = await dst_provider.get_balance(dst_address, claim_data.dst_hash);
    console.info(`new receiver = ${JSON.stringify(new_receiver)}`);

    let exclude = ['0000000000000000000000000000000000000000000000000000000000000000'];
    let receiver_diff = balance_diff(old_receiver, new_receiver, exclude);
    console.info(`receiver_diff = ${JSON.stringify(receiver_diff)}`);
    assert(Object.values(receiver_diff).length === 1, `Receiver must have changed exactly one value (excluding ${JSON.stringify(exclude)}), has ${Object.values(receiver_diff).length}`);
    
    let dst_hash = Object.keys(receiver_diff)[0];
    let dst_amount = Object.values(receiver_diff)[0];
    let src_amount = amount;

    console.debug(`Reading token_info for ${dst_hash} at ${dst_network}`);
    let dst_token_info = await dst_provider.get_token_info(dst_hash);
    console.debug(`dst_token_info = ${JSON.stringify(dst_token_info)}`);

    let dst_decimals = dst_token_info.decimals;

    console.debug(`Reading token_info for ${src_hash} at ${src_network}`);
    let src_token_info = await src_provider.get_token_info(src_hash);
    console.debug(`src_token_info = ${JSON.stringify(src_token_info)}`);
    let src_decimals = src_token_info.decimals;

    console.debug(`dst_amount = ${dst_amount}, src_amount = ${src_amount}, dst_decimals = ${dst_decimals}, src_decimals = ${src_decimals}`);

    if (src_decimals > dst_decimals){
      assert(BigInt(dst_amount) * BigInt(10) ** BigInt(src_decimals - dst_decimals) === BigInt(src_amount));
    } else {
      assert(BigInt(src_amount) * BigInt(10) ** BigInt(dst_decimals - src_decimals) === BigInt(dst_amount));
    }

    console.info(`Bridge successfull, dst_hash = ${dst_hash}`);

    return {dst_hash};
}

let absolute = function(display, decimals){
  let result;
  let point = display.indexOf('.');
  if (point < 0){
    result = display + "0".repeat(decimals);
  } else {
    result = display.replace(/0+$/, ''); //replace trailing zeroes
    point = result.indexOf('.');
    let l = result.length;
    result = result.slice(0, point) + result.slice(point + 1); //replace decimal point
    result = result + "0".repeat(decimals - (l - point - 1));
  }
  return BigInt(result);
}

describe('happy_case_1', function () {
  this.timeout(0);
  this.slow(60*60*1000);

  before(async function(){

    BigInt.prototype.toJSON = function() { return this.toString() }

    console.info(`Updating network and token data...`);

    ENGLAND.id = (await ENGLAND.provider.read_state()).network_id;
    MEXICO.id = (await MEXICO.provider.read_state()).network_id;
    GERMANY.id = (await GERMANY.provider.read_state()).network_id;

    POUND_DECIMALS = await get_decimals(ENGLAND, POUND);
    PESO_DECIMALS = await get_decimals(MEXICO, PESO);
    MARK_DECIMALS = await get_decimals(GERMANY, MARK);

    console.log('Update complete');
  });

  it(`debug`, async function(){
    let src_address = '0x03c91e88967465c44aa2afeab3b87dbeede9bd63dbe4a0121ea02fa3f0f4a4e2a8';
    let src_hash = '0x0000000000000000000000000000000000000000000000000000000000000000';
    let src_network = 11;
    let dst_address = '0x1E4d77e8cCd3964ad9b10Bdba00aE593DF1112A1';
    //let tr = await ENGLAND.provider.read_transfers(src_address, src_hash, src_network, dst_address);

   // console.trace(absolute("0.002", 5));

    assert(absolute("12.3", 5) === BigInt(1230000));
    assert(absolute("12", 5) === BigInt(1200000));
    assert(absolute("12.00000000000", 5) === BigInt(1200000));
    assert(absolute("0.002", 5) === BigInt(200));

    //console.log(tr);
  });

  it.only('forward test', async function() {
    console.log(`===== ENGLAND TO MEXICO =========================================`);

    let bridge1 = await simple_bridge(ENGLAND, ALICE_PUBKEY, POUND, 3e15, MEXICO, JOSE_PUBKEY);
  });

  it('backward test', async function() {
    console.log(`===== MEXICO TO ENGLAND =========================================`);

    let bridge1 = await simple_bridge(MEXICO, JOSE_PUBKEY, PESO, 200, ENGLAND, ALICE_PUBKEY);
  });

  it('forth and back test', async function() {
    console.log(`===== ENGLAND TO MEXICO =========================================`);

    let bridge1 = await simple_bridge(ENGLAND, ALICE_PUBKEY, POUND, 4e15, MEXICO, JOSE_PUBKEY);
    let mexican_pound = bridge1.dst_hash;

    console.log(`===== MEXICO TO ENGLAND =========================================`);

    let bridge2 = await simple_bridge(MEXICO, JOSE_PUBKEY, mexican_pound, 4, ENGLAND, ALICE_PUBKEY);
    assert(POUND === bridge2.dst_hash, "Reverse transfer must unlock, not mint");
  });

  it('back and forth test', async function() {
    console.log(`===== MEXICO TO ENGLAND =========================================`);

    let bridge1 = await simple_bridge(MEXICO, JOSE_PUBKEY, PESO, 5, ENGLAND, ALICE_PUBKEY);
    let british_peso = bridge1.dst_hash;

    console.log(`===== ENGLAND TO MEXICO =========================================`);

    let bridge2 = await simple_bridge(ENGLAND, ALICE_PUBKEY, british_peso, 4e15, MEXICO, JOSE_PUBKEY);
    assert(PESO === bridge2.dst_hash, "Reverse transfer must unlock, not mint");
  });

  it('round logic test', async function () {

    console.log(`===== ENGLAND TO MEXICO =========================================`);

    let bridge1 = await simple_bridge(ENGLAND, ALICE_PUBKEY, POUND, 5e15, MEXICO, JOSE_PUBKEY);
    let mexican_pound = bridge1.dst_hash;

    console.log(`===== MEXICO TO ENGLAND =========================================`);

    let bridge2 = await simple_bridge(MEXICO, JOSE_PUBKEY, mexican_pound, 3, ENGLAND, ALICE_PUBKEY);
    assert(POUND === bridge2.dst_hash, "Reverse transfer must unlock, not mint");

    console.log(`===== MEXICO TO GERMANY =========================================`);

    let bridge3 = await simple_bridge(MEXICO, JOSE_PUBKEY, mexican_pound, 2, GERMANY, HANS_PUBKEY);
    let german_pound = bridge3.dst_hash;

    console.log(`===== ENGLAND TO GERMANY ========================================`);

    let bridge4 = await simple_bridge(ENGLAND, ALICE_PUBKEY, POUND, 5e14, GERMANY, HANS_PUBKEY);
    assert (bridge4.dst_hash === german_pound, "two-way transfers must merge tokens");

    console.log(`===== GERMANY TO ENGLAND ========================================`);

    let bridge5 = await simple_bridge(GERMANY, HANS_PUBKEY, german_pound, 6, ENGLAND, ALICE_PUBKEY);
    assert(POUND === bridge5.dst_hash, "Circular transfer must unlock, not mint");

    return 0;
  });
/*
  it('unkonwn network test', async function () {
    console.log(`===== GERMANY TO MEXICO =========================================`);

    let src_network_obj = GERMANY;
    let src_address = HANS_PUBKEY;
    let src_hash = MARK;
    let amount = 50;
    let dst_network_obj = MEXICO;
    let dst_address = JOSE_PUBKEY;

    let src_provider = src_network_obj.provider;
    let dst_provider = dst_network_obj.provider;
    let src_network = src_network_obj.id;
    let dst_network = dst_network_obj.id;


    console.debug(`Checking balance of ${src_address} at ${src_network}`);
    let old_sender = await src_provider.get_balance(src_address, src_hash);
    console.info(`old sender = ${JSON.stringify(old_sender)}`);

    console.debug('Alice sending transaction...')
    let lock_hash = await src_provider.send_lock({dst_address, dst_network, amount, src_hash, src_address});
    assert(lock_hash !== null, 'Failed to send lock transaction');

    console.debug(`Waiting for approve of ${lock_hash}`);
    let lock_result = await wait_for(src_provider.wait_lock.bind(src_provider), [lock_hash], (r) => {return r === true}, config.tx_confirmation_delay_ms);
    assert(lock_result !== null, 'Failed to approve lock');

    console.debug(`Reading lock data of ${lock_hash}`);
    let lock_data = await src_provider.read_lock(lock_hash);
    assert(lock_data === null, `Lock data must be null got ${lock_data} instead`);
  });*/
});
