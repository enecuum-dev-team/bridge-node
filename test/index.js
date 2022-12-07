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

let assert = require('assert');
let request = require('request');

let EthereumNetwork = require('../provider_ethereum.js');
//let EnecuumNetwork = require('../provider_enecuum.js');
let TestNetwork = require('../provider_test.js');

let config = {
  pound: "0xa0C408e3accC71cc5a3946635AbB23d1cC16cf67",
  alice_pubkey: "0xf784C9bca8BbDD93A195aeCdBa23472f89B1E7d6",
  jose_pubkey: "111",
  hans_pubkey: "HANS",
}

const POUND = config.pound;
const ALICE_PUBKEY = config.alice_pubkey;
const JOSE_PUBKEY = config.jose_pubkey;
const HANS_PUBKEY = config.hans_pubkey;

let validators = [{url:"http://localhost:8080/api/v1/notify"}];

//let ENGLAND = {provider : new TestNetwork({"url" : "http://localhost:8017", "type" : "test", "caption" : "ENGLAND"})};
let MEXICO = {provider : new TestNetwork({"url" : "http://localhost:8023", "type" : "test", "caption" : "MEXICO"})};
let GERMANY = {provider : new TestNetwork({"url" : "http://localhost:8029", "type" : "test", "caption" : "GERMANY"})};

let ENGLAND = {provider : new EthereumNetwork({
      "url" : "https://goerli.infura.io/v3/3fc3a01d3c4544b5a4ba1bea928c62a0",
      "type" : "ethereum",
      "contract_address" : "0x618Cbb78c1C240fE51A1C2E738C389F74E152c4E",
      "caption" : "ENGLAND",
      "pubkey" : "",
      "prvkey" : "8f62ac644f5f694621b3e4107277004b328acfb8709bd07db056c1ff861f093e",
      "abi" : [{"inputs":[{"internalType":"uint24","name":"id","type":"uint24"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes","name":"dst_address","type":"bytes"},{"indexed":false,"internalType":"uint24","name":"dst_network","type":"uint24"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"address","name":"hash","type":"address"},{"indexed":false,"internalType":"address","name":"src_address","type":"address"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes","name":"dst_address","type":"bytes"},{"indexed":false,"internalType":"uint24","name":"dst_network","type":"uint24"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"address","name":"hash","type":"address"},{"indexed":false,"internalType":"address","name":"src_address","type":"address"}],"name":"Lock","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"dst_address","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Unlock","type":"event"},{"inputs":[{"internalType":"address","name":"validator","type":"address"}],"name":"addValidator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"decimals","type":"uint256"}],"name":"add_network","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"dst_address","type":"address"},{"internalType":"uint256","name":"dst_network","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"src_hash","type":"bytes"},{"internalType":"bytes","name":"src_address","type":"bytes"},{"internalType":"uint256","name":"src_network","type":"uint256"},{"internalType":"bytes","name":"origin_hash","type":"bytes"},{"internalType":"uint256","name":"origin_network","type":"uint256"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"symbol","type":"string"}],"internalType":"struct SPACE_BRIDGE.TICKET","name":"ticket","type":"tuple"},{"components":[{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"internalType":"struct ECDSA.SIGNATURES[]","name":"signatures","type":"tuple[]"}],"name":"claim","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"invoices","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"known_networks","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes","name":"dst_address","type":"bytes"},{"internalType":"uint24","name":"dst_network","type":"uint24"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"hash","type":"address"}],"name":"lock","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"minted","outputs":[{"internalType":"uint256","name":"origin_network","type":"uint256"},{"internalType":"bytes","name":"origin_hash","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"network_id","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"parameters","outputs":[{"internalType":"uint256","name":"origin_network","type":"uint256"},{"internalType":"bytes","name":"origin_hash","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"validator","type":"address"}],"name":"removeValidator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"value","type":"uint24"}],"name":"set_threshold","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"threshold","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes","name":"data","type":"bytes"}],"name":"toAddress","outputs":[{"internalType":"address","name":"addr","type":"address"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"transfers","outputs":[{"internalType":"bytes","name":"dst_address","type":"bytes"},{"internalType":"uint256","name":"src_network","type":"uint256"},{"internalType":"bytes","name":"src_hash","type":"bytes"},{"internalType":"uint256","name":"nonce","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"validators","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"hash","type":"bytes32"},{"components":[{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"internalType":"struct ECDSA.SIGNATURES[]","name":"signatures","type":"tuple[]"}],"name":"verify","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}]
    })};

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
    let old_sender = await src_provider.get_balance(src_address, src_hash);
    console.info(`old sender = ${JSON.stringify(old_sender)}`);

    console.debug('Alice sending transaction...')
    let lock_hash = await src_provider.send_lock({dst_address, dst_network, amount, src_hash, src_address});
    assert(lock_hash !== null, 'Failed to send lock transaction');

    console.debug(`Waiting for approve of ${lock_hash}`);
    let lock_result = await wait_for(src_provider.wait_lock.bind(src_provider), [lock_hash], (r) => {return r === true}, 3000);
    assert(lock_result !== null, 'Failed to approve lock');

    console.debug(`Checking balance of ${src_address} at ${src_network}`);
    let new_sender = await src_provider.get_balance(src_address, src_hash);
    console.info(`new sender = ${JSON.stringify(new_sender)}`);

    let sender_diff = balance_diff(old_sender, new_sender);
    console.info(`sender_diff = ${JSON.stringify(sender_diff)}`);
    assert(BigInt(sender_diff[src_hash]) === BigInt(-1 * amount), `Sender amount must decrease`);

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
    assert(BigInt(Object.values(receiver_diff)[0]) === BigInt(amount), `Receiver amount must increase`);

    let dst_hash = Object.keys(receiver_diff)[0];

    return {dst_hash};
}

describe('happy_case_1', function () {
  this.timeout(0);

  before(async function(){

    BigInt.prototype.toJSON = function() { return this.toString() }

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
