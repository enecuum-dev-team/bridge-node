let assert = require('assert');
let request = require('request');

let EthereumNetwork = require('../provider_ethereum.js');
let EnecuumNetwork = require('../provider_enecuum.js');
let TestNetwork = require('../provider_test.js');

let config = {
  pound: "POUND_HASH",
  alice_pubkey: "ALICE",
  jose_pubkey: "JOSE",
  hans_pubkey: "HANS",
}

const POUND = config.pound;
const ALICE_PUBKEY = config.alice_pubkey;
const JOSE_PUBKEY = config.jose_pubkey;
const HANS_PUBKEY = config.hans_pubkey;

let validators = [{url:"http://localhost:8080/api/v1/notify"}];

let ENGLAND = {provider : new EnecuumNetwork({"url" : "http://95.216.207.173", "type" : "enecuum", "caption" : "ENGLAND"})};
let MEXICO = {provider : new TestNetwork({"url" : "http://localhost:8023", "type" : "test", "caption" : "MEXICO"})};
let GERMANY = {provider : new TestNetwork({"url" : "http://localhost:8029", "type" : "test", "caption" : "GERMANY"})};

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

let sleep = function(ms){
        return new Promise(function(resolve, reject){
                setTimeout(() => resolve(), ms)
        });
};

let wait_for = async function(method, args, condition, timeout_ms){
  let result;

  let start = new Date();
  let span = timeout_ms;

  do {
    response = await method(...args);

    if (condition(response)){
      return response;
    } else {
      await sleep(1000);
    }

    now = new Date();
    span -= ((now - start) / 10);
  } while (span > 0);

  console.log('wait end');

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

let balance_diff = function(old_balance, new_balance){
  let diff = {};
    for (let n in new_balance){
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
    return diff;
}

let simple_bridge = async function(src_network_obj, src_address, src_hash, amount, dst_network_obj, dst_address){
    let src_provider = src_network_obj.provider;
    let dst_provider = dst_network_obj.provider;
    let src_network = src_network_obj.id;
    let dst_network = dst_network_obj.id;


    console.debug(`Checking balance of ${src_address} at ${src_network}`);
    let old_sender = await src_provider.get_balance(src_address);
    console.info(`old sender = ${JSON.stringify(old_sender)}`);

    console.debug('Alice sending transaction...')
    let lock_hash = await src_provider.send_lock({dst_address, dst_network, amount, src_hash, src_address});
    assert(lock_hash !== null, 'Failed to send lock transaction');

    console.debug(`Waiting for approve of ${lock_hash}`);
    let lock_result = await wait_for(src_provider.wait_lock.bind(src_provider), [lock_hash], (r) => {return r === true}, 3000);
    assert(lock_result !== null, 'Failed to approve lock');

    console.debug(`Checking balance of ${src_address} at ${src_network}`);
    let new_sender = await src_provider.get_balance(src_address);
    console.info(`new sender = ${JSON.stringify(new_sender)}`);

    let sender_diff = balance_diff(old_sender, new_sender);
    console.info(`sender_diff = ${JSON.stringify(sender_diff)}`);
    assert(sender_diff[src_hash] === -1 * amount, `Sender amount must decrease`);

    console.debug(`Quering validator with hash ${lock_hash}`);
    let ticket = await http_post(validators[0].url, {networkId : src_network, txHash : lock_hash});
    assert(ticket.err === undefined, `Validator denied to confirm lock, ticket = ${JSON.stringify(ticket)}`);

    console.debug(`Checking balance of ${dst_address} at ${dst_network}`);
    let old_receiver = await dst_provider.get_balance(dst_address);
    console.info(`old receiver = ${JSON.stringify(old_receiver)}`);

    console.debug(`Claim ${JSON.stringify(ticket)} at ${dst_network}`);
    let claim_hash = await dst_provider.send_claim(ticket);
    assert(claim_hash !== null, 'Failed to send claim transaction');

    console.debug(`Waiting for approve of ${claim_hash}`);
    let claim_result = await wait_for(dst_provider.wait_claim.bind(dst_provider), [claim_hash], (r) => {return r === true}, 3000);
    assert(claim_result !== null, 'Failed to approve claim');

    console.debug(`Parsing claim ${claim_hash}`);
    let claim_data = await dst_provider.read_claim(claim_hash);
    console.info(`Claim data = ${JSON.stringify(claim_data)}`);

    console.debug(`Checking balance of ${dst_address} at ${dst_network}`);
    let new_receiver = await dst_provider.get_balance(dst_address, claim_data.dst_hash);
    console.info(`new receiver = ${JSON.stringify(new_receiver)}`);

    let receiver_diff = balance_diff(old_receiver, new_receiver);
    console.info(`receiver_diff = ${JSON.stringify(receiver_diff)}`);
    assert(Object.values(receiver_diff)[0] === amount, `Receiver amount must increase`);

    let dst_hash = Object.keys(receiver_diff)[0];

    return {dst_hash};
}

describe('happy_case_1', function () {
  this.timeout(0);

  before(async function(){
    console.info(`Updating network ids...`);

    ENGLAND.id = (await ENGLAND.provider.read_state()).network_id;
    MEXICO.id = (await MEXICO.provider.read_state()).network_id;
    GERMANY.id = (await GERMANY.provider.read_state()).network_id;

    console.log('Update complete');
  });

  it('minting logic test', async function () {

    let bridge1 = await simple_bridge(ENGLAND, ALICE_PUBKEY, POUND, 100, MEXICO, JOSE_PUBKEY);
    let mexican_pound = bridge1.dst_hash;

    console.log(`===============================================================`);

    let bridge2 = await simple_bridge(MEXICO, JOSE_PUBKEY, mexican_pound, 50, ENGLAND, ALICE_PUBKEY);
    assert(POUND === bridge2.dst_hash, "Reverse transfer must unlock, not mint");

    console.log(`===============================================================`);

    let bridge3 = await simple_bridge(MEXICO, JOSE_PUBKEY, mexican_pound, 50, GERMANY, HANS_PUBKEY);
    let german_pound = bridge3.dst_hash;

    console.log(`===============================================================`);

    let bridge4 = await simple_bridge(ENGLAND, ALICE_PUBKEY, POUND, 50, GERMANY, HANS_PUBKEY);
    assert (bridge4.dst_hash === german_pound, "two-way transfers must merge tokens");

    console.log(`===============================================================`);

    let bridge5 = await simple_bridge(GERMANY, HANS_PUBKEY, german_pound, 100, ENGLAND, ALICE_PUBKEY);
    assert(POUND === bridge5.dst_hash, "Circular transfer must unlock, not mint");

    return 0;
  });
});
