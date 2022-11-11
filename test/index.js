let assert = require('assert');
let request = require('request');
let keys = require("../keys.json");

let EthereumNetwork = require('../provider_ethereum.js');
let EnecuumNetwork = require('../provider_enecuum.js');
let TestNetwork = require('../provider_test.js');

const ENGLAND = 17;
const ALICE_PUBKEY = "11111";
const BOB_PUBKEY = "22222";
const POUND = "0000000000000000000000000000000000000000000000000000000000000000";

const MEXICO = "23";
const JOSE_PUBKEY = keys.enecuum.pubkey;
const ISABEL_PUBKEY = "666"

let validators = [{url:"http://localhost:8080/api/v1/notify"}];

let network1 = new EnecuumNetwork({"url" : "http://95.216.207.173", "type" : "enecuum", "caption" : "bitdev", "ticker" : "0000000000000000000000000000000000000000000000000000000000000000", "genesis" : keys.enecuum});
let network2 = new TestNetwork({"url" : "http://localhost:8023", "type" : "test", "caption" : "MEXICO"});

console.trace = function (...msg) {
  console.log(...msg);
};

console.debug = function (...msg) {
  console.log(...msg);
};

console.silly = function (...msg) {
  console.log(...msg);
};

console.fatal = function (...msg) {
  console.log(...msg);
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

describe('happy_case_1', function () {
  this.timeout(0);

  it('First bridge from Alice to Jose', async function () {

    let src_address = ALICE_PUBKEY;
    let dst_address = JOSE_PUBKEY;
    let src_network = ENGLAND;
    let dst_network = MEXICO;
    let src_hash = POUND;
    let amount = 100;

    console.info(`Checking balance of ${src_address} at ${src_network}`);
    let old_sender = await network1.get_balance(src_address);
    console.info(`old sender = ${JSON.stringify(old_sender)}`);

    console.info('Alice sending transaction...')
    let lock_hash = await network1.send_lock({dst_address, dst_network, amount, src_hash, src_address}, keys.enecuum.prvkey);
    assert(lock_hash !== null, 'Failed to send lock transaction');

    console.info(`Waiting for approve of ${lock_hash}`);
    let lock_result = await wait_for(network1.wait_lock.bind(network1), [lock_hash], (r) => {return r === true}, 3000);
    assert(lock_result !== null, 'Failed to approve lock');

    console.info(`Checking balance of ${src_address} at ${src_network}`);
    let new_sender = await network1.get_balance(src_address);
    console.info(`new sender = ${JSON.stringify(new_sender)}`);

    let sender_diff = balance_diff(old_sender, new_sender);
    console.info(`sender_diff = ${JSON.stringify(sender_diff)}`);
    assert(sender_diff[src_hash] === -1 * amount, `Sender amount must decrease`);

    console.info(`Quering validator with hash ${lock_hash}`);
    let ticket = await http_post(validators[0].url, {networkId : src_network, txHash : lock_hash});
    assert(ticket.ticket !== null, `Validator denied to confirm lock, ticket = ${JSON.stringify(ticket)}`);

    console.info(`Checking balance of ${dst_address} at ${dst_network}`);
    let old_receiver = await network2.get_balance(dst_address);
    console.info(`old receiver = ${JSON.stringify(old_receiver)}`);

    console.info(`Claim ${JSON.stringify(ticket)} at ${dst_network}`);
    let claim_hash = await network2.send_claim(ticket);
    assert(claim_hash !== null, 'Failed to send claim transaction');

    console.info(`Waiting for approve of ${claim_hash}`);
    let claim_result = await wait_for(network2.wait_claim.bind(network2), [claim_hash], (r) => {return r === true}, 3000);
    assert(claim_result !== null, 'Failed to approve claim');

    console.info(`Parsing claim ${claim_hash}`);
    let claim_data = await network2.read_claim(claim_hash);
    console.info(`Claim data = ${JSON.stringify(claim_data)}`);

    console.info(`Checking balance of ${dst_address} at ${dst_network}`);
    let new_receiver = await network2.get_balance(dst_address, claim_data.dst_hash);
    console.info(`new receiver = ${JSON.stringify(new_receiver)}`);

    let receiver_diff = balance_diff(old_receiver, new_receiver);
    console.info(`receiver_diff = ${JSON.stringify(receiver_diff)}`);
    assert(Object.values(receiver_diff)[0] === amount, `Receiver amount must increase`);

    return 0;
  });
});