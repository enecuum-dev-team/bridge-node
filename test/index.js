let assert = require('assert');
let request = require('request');

let EthereumNetwork = require('../provider_ethereum.js');
let EnecuumNetwork = require('../provider_enecuum.js');
let TestNetwork = require('../provider_test.js');

const ENGLAND = 17;
const ALICE_PUBKEY = "11111";
const BOB_PUBKEY = "22222";
const POUND = "33333";

const MEXICO = 23;
const JOSE_PUBKEY = "555";
const ISABEL_PUBKEY = "666"

let validators = [{url:"http://localhost:8080/api/v1/notify"}];

let network1 = new TestNetwork({"url" : "http://localhost:8017", "type" : "test", "caption" : "ENGLAND"});
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


describe('happy_case_1', function () {
  this.timeout(0);

  it('First bridge from Alice to Jose', async function () {

    console.info('Alice sending transaction...')
    let lock_hash = await network1.send_lock({dst_address:JOSE_PUBKEY, dst_network:MEXICO, amount:100, src_hash:POUND, src_address:ALICE_PUBKEY});
    assert(lock_hash !== null, 'Failed to send lock transaction');

    console.info(`Waiting for approve of ${lock_hash}`);
    let result = await wait_for(network1.read_lock.bind(network1), [lock_hash], (r) => {return r !== null}, 8000);
    assert(lock_hash !== null, 'Failed to approve');

    console.info(`Quering validator with hash ${lock_hash}`);
    let ticket = await http_post(validators[0].url, {networkId : ENGLAND, txHash : lock_hash});

    console.info(`Checking balance of ${JOSE_PUBKEY} at ${MEXICO}`);
    let old_account = await network1.read_account(JOSE_PUBKEY);
    //console.trace(account);

    console.info(`Claim ${JSON.stringify(ticket)} at ${MEXICO}`);
    let claim_hash = await network1.send_claim(ticket);
    assert(claim_hash !== null, 'Failed to send claim transaction');

    console.info(`Checking balance of ${JOSE_PUBKEY} at ${MEXICO}`);
    let new_account = await network1.read_account(JOSE_PUBKEY);
    let changes = new_account.filter(n => {return !old_account.some(o => (o.hash === n.hash) && (o.amount === n.amount))});
    console.info(`Balance of ${JOSE_PUBKEY} changed to ${JSON.stringify(changes)}`);
    assert(changes.length !== null, `No tokens transferred to address ${JOSE_PUBKEY} at ${MEXICO}`);

    return 0;
  });
});