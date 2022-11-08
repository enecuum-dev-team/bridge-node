let argv = require('yargs').argv;
let Node = require('./validator.js');
let fs = require('fs');

const CONFIG_FILENAME = 'config.json';
let config = {
	"port" : 8080,
	"loglevel" : "trace",
	"networks" : [
		{
			"url" : "https://goerli.infura.io/v3/3fc3a01d3c4544b5a4ba1bea928c62a0",
			"type" : "ethereum",
			"contract_address" : "0x5Bb96CA9ac4dba8Db9C8fF143Bd3938b758Cba5b",
			"caption" : "goerli",
			"pubkey" : "",
			"prvkey" : "4d7c91407e5954e6b80e2c5f3658363452cf932b3a74fa4703472a7978960302",
			"abi" : [{"inputs":[{"internalType":"uint24","name":"id","type":"uint24"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes","name":"dst_address","type":"bytes"},{"indexed":false,"internalType":"uint24","name":"dst_network","type":"uint24"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"address","name":"hash","type":"address"},{"indexed":false,"internalType":"address","name":"src_address","type":"address"}],"name":"Lock","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[{"internalType":"address","name":"validator","type":"address"}],"name":"addValidator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"decimals","type":"uint256"}],"name":"add_network","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"dst_address","type":"address"},{"internalType":"uint24","name":"dst_network","type":"uint24"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes32","name":"src_hash","type":"bytes32"},{"internalType":"bytes32","name":"src_address","type":"bytes32"},{"internalType":"uint24","name":"src_network","type":"uint24"},{"internalType":"bytes32","name":"origin_hash","type":"bytes32"},{"internalType":"uint24","name":"origin_network","type":"uint24"},{"internalType":"uint256","name":"origin","type":"uint256"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"symbol","type":"string"}],"internalType":"struct TABULA_BRIDGE.TICKET","name":"ticket","type":"tuple"},{"components":[{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"internalType":"struct TABULA_BRIDGE.SIGNATURES[]","name":"signatures","type":"tuple[]"}],"name":"claim","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"invoices","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"known_networks","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes","name":"dst_address","type":"bytes"},{"internalType":"uint24","name":"dst_network","type":"uint24"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"hash","type":"address"}],"name":"lock","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"string","name":"receiver","type":"string"}],"name":"lock_old","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"minted","outputs":[{"internalType":"uint24","name":"origin","type":"uint24"},{"internalType":"bytes32","name":"origin_hash","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"network_id","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"parameters","outputs":[{"internalType":"uint256","name":"origin","type":"uint256"},{"internalType":"bytes32","name":"origin_hash","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"validator","type":"address"}],"name":"removeValidator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"value","type":"uint24"}],"name":"set_threshold","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"str","type":"string"},{"internalType":"uint256","name":"startIndex","type":"uint256"},{"internalType":"uint256","name":"endIndex","type":"uint256"}],"name":"substring","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"threshold","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes","name":"a","type":"bytes"}],"name":"toAddress","outputs":[{"internalType":"address","name":"addr","type":"address"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"a","type":"address"}],"name":"toBytes","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"transfers","outputs":[{"internalType":"bytes32","name":"dst_address","type":"bytes32"},{"internalType":"uint24","name":"src_network","type":"uint24"},{"internalType":"bytes32","name":"src_hash","type":"bytes32"},{"internalType":"uint256","name":"nonce","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"enqTxHash","type":"bytes32"},{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"receiver","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint8[]","name":"v","type":"uint8[]"},{"internalType":"bytes32[]","name":"r","type":"bytes32[]"},{"internalType":"bytes32[]","name":"s","type":"bytes32[]"}],"name":"unlock","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"validators","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"validatorsCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"hash","type":"bytes32"},{"internalType":"uint8[]","name":"v","type":"uint8[]"},{"internalType":"bytes32[]","name":"r","type":"bytes32[]"},{"internalType":"bytes32[]","name":"s","type":"bytes32[]"}],"name":"verify","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}]
		},
		{
			"url" : "http://95.216.207.173",
			"type" : "enecuum",
			"caption" : "bitdev",
			//validator1
			//"pubkey" : "02792cf144cf81326db717a5316d0a2df0fb937be5a4dd970d34883b00b16315f2",
			//"prvkey" : "c4310dc5e1401e223d2f54f3bcab82c47b684a71c64960df3b450e2f50836cbb"
			//validator2
			"pubkey" : "02375a89c4cd7a7410fcf90c6b144d82ea48c03e96d9c335b63627300771e67293",
			"prvkey" : "9f3ba631a5a8aa6d502b7c67317f51db71648cefafccd6c3c101db1feef60dd1"
			//validator3
			//"pubkey" : "02fd060ad909004756e8f29929a71ce2734de3ad394a99affd66a26706a292583d",
			//"prvkey" : "2d25317fe918879e46abf9f8b475a60398c568dc074cbc94e78a5a94fc015c3f"
		},
		{
			"url" : "http://localhost:8017",
			"type" : "test",
			"caption" : "ENGLAND",
			//validator1
			//"pubkey" : "02792cf144cf81326db717a5316d0a2df0fb937be5a4dd970d34883b00b16315f2",
			//"prvkey" : "c4310dc5e1401e223d2f54f3bcab82c47b684a71c64960df3b450e2f50836cbb"
			//validator2
			"pubkey" : "111",
			"prvkey" : "111"
			//validator3
			//"pubkey" : "02fd060ad909004756e8f29929a71ce2734de3ad394a99affd66a26706a292583d",
			//"prvkey" : "2d25317fe918879e46abf9f8b475a60398c568dc074cbc94e78a5a94fc015c3f"
		},
		{
			"url" : "http://localhost:8023",
			"type" : "test",
			"caption" : "MEXICO",
			//validator1
			//"pubkey" : "02792cf144cf81326db717a5316d0a2df0fb937be5a4dd970d34883b00b16315f2",
			//"prvkey" : "c4310dc5e1401e223d2f54f3bcab82c47b684a71c64960df3b450e2f50836cbb"
			//validator2
			"pubkey" : "222",
			"prvkey" : "222"
			//validator3
			//"pubkey" : "02fd060ad909004756e8f29929a71ce2734de3ad394a99affd66a26706a292583d",
			//"prvkey" : "2d25317fe918879e46abf9f8b475a60398c568dc074cbc94e78a5a94fc015c3f"
		}	]
};

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

require('console-stamp')(console, {datePrefix: '[', pattern:'yyyy.mm.dd HH:MM:ss', level: config.loglevel, extend:{fatal:0, debug:4, trace:5, silly:6}, include:['silly', 'trace','debug','info','warn','error','fatal']});

console.info("Application started");

let config_filename = argv.config || CONFIG_FILENAME;

console.info('Loading config from', config_filename, '...');

let cfg = {};
try {
	cfg = JSON.parse(fs.readFileSync(config_filename, 'utf8'));
	config = Object.assign(config, cfg);
} catch (e) {
	console.info('No configuration file found')
}

config = Object.assign(config, argv);

console.info(`config = ${JSON.stringify(config)}`);

let node = new Node(config);
node.start();