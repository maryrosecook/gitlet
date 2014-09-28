var gimletApi = require('./gimlet-api');
var parseOptions = require('./parse-options');

var gimlet = module.exports = function(argv) {
  var rawArgs = parseOptions(argv);
  var commandFnName = rawArgs._[2].replace(/-/g, "_");
  var fn = gimletApi[commandFnName];
  var commandArgs = rawArgs._.slice(3);
  var unspecifiedArgs = Array
      .apply(null, new Array(fn.length - commandArgs.length - 1))
      .map(function() { return undefined; });
  return fn.apply(gimletApi, commandArgs.concat(unspecifiedArgs).concat(rawArgs));
};

if (require.main === module) {
  var result = gimlet(process.argv);
  if (result !== undefined) {
    console.log(result);
  }
}
