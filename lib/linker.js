"use strict";

var fs = require('fs');
var util = require('util');
var Compiler = require('./compiler');

var Linker = module.exports = function() {
	var self = this;

	self.symTable = null;
	self.compiler = new Compiler();
};

Linker.prototype.link = function(filename, opts, callback) {
	var self = this;

	var output = [];

	function _gen(s) {
		output.push(s);
	}
	/*console.log("sym table is ", self.symTable.table["node_modules/devicemsghandler/index.js"]);*/
//	_gen(util.format('(function() {'));
	_gen(util.format('var _npk = this;'));
	_gen(util.format('_npk.cache = {};'));
	_gen(util.format('_npk.syms = %s;', JSON.stringify(self.symTable.table)));
	_gen(util.format('_npk.load = %s;', function(symbol) {
		
		symbol = symbol.replace(/\\/g, '/')
		console.log('[NPK] symbol after replaced', symbol);
		//console.log('_npk.sysms', self.symTable.table);
		if (!_npk.syms[symbol])
			throw new Error('Undefined symbol \'' + symbol + '\'');

		if (_npk.cache[symbol])
			return _npk.cache[symbol];

		var vm = require("vm");
		var path = require("path");
		var sym = _npk.syms[symbol];

		var module = {
			id: symbol,
			exports: {},
			loaded: false,
			exited: false,
			children: [],
			paths: []
		};

		var sandbox = {};

		for (var k in global) {
			sandbox[k] = global[k];
		}

		sandbox.exports = module.exports;
		sandbox.__filename = symbol;
		/*sandbox.__dirname = path.dirname(symbol);*/
		///console.log('sandbox.dirname', sandbox.__dirname, __filename);
		sandbox.module = module;
		sandbox.global = sandbox;
		sandbox.root = root;
		sandbox.__dirname = process.cwd();
		
		sandbox.modulePath = path.dirname(symbol);
		console.log("[NPK] sandbox dirname is ", sandbox.__dirname);
		/*console.log("[NPK] sandbox process.cwd is ", process.cwd());*/
	

		// Override require function
		sandbox.require = function(mod) {
			console.log("[NPK] require modules", mod);
			
			
			if (mod.slice(0, 1) === '.') {
				var modPath = path.join(sandbox.modulePath, mod).replace('\\', '/');	
				/*var modPath = path.join(sandbox.__dirname, mod).replace('\\', '/');*/
				try{
					return loadPackagedModule(modPath);	
				}catch(e){
					modPath = path.join(modPath, 'index').replace(/\\/g, '/');
					return loadPackagedModule(modPath);	
				}	
				
			} else {
				var module = '';
				try{
					module = require(mod);	
				}catch(e){
					var thirdPartyModPath = path.join("node_modules", mod).replace(/\\/g, '/');
					var thirdPartyMainModPath = path.join(thirdPartyModPath, "index").replace(/\\/g, '/');

					console.log('[NPK] [third party module] third party Path', thirdPartyModPath);
					console.log('[NPK] [third party module] third party main mod Path', thirdPartyMainModPath);

					console.log('[NPK] [third party module] symbol path', symbol);
					try{
						module = loadPackagedModule(thirdPartyModPath);	
					}catch(e){
						module = loadPackagedModule(thirdPartyMainModPath);
					}
				}
				
			
				return module;
				
			}
		};
		function loadPackagedModule (modPath){
			try {
				return _npk.load(modPath);
			} catch(e) {
				console.log("[NPK] load failed Try load with .js symbol");
				return _npk.load(modPath + '.js');
				
			}
		}
		
		
		var file = sym.data.replace(/^\#\!.*/, "")
		//console.log("[NPK] new context's file ", file);
		vm.runInNewContext(file, sandbox, symbol);

		// Cache
		_npk.cache[symbol] = module.exports;

		return module.exports;
	}));

	// Entry point
	if (opts.entry) {
		_gen(util.format('module.exports = _npk.load(\'%s\');', opts.entry));
	} else {
		_gen(util.format('module.exports = %s;', function(symbol) {

			return _npk.load(symbol);
		}));
	}


//	if (opts.level < 3)
//		_gen(util.format('})();'));

	// Compile and compress
	self.compiler.compile(output.join(''), {
		output: filename,
		level: opts.level || 1
	}, function(err, data) {

		if (data) {
			fs.writeFile(filename, data, function(err) {
				callback(err);
			});
			return;
		}

		callback(err);
	});
};
