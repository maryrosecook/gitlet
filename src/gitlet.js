var gitletApi = require('./gitlet-api');
var parseOptions = require('./parse-options');

var gitlet = module.exports = function(argv) {
  var rawArgs = parseOptions(argv);
  var commandFnName = rawArgs._[2].replace(/-/g, "_");
  var fn = gitletApi[commandFnName];
  var commandArgs = rawArgs._.slice(3);
  var unspecifiedArgs = Array
      .apply(null, new Array(fn.length - commandArgs.length - 1))
      .map(function() { return undefined; });
  return fn.apply(gitletApi, commandArgs.concat(unspecifiedArgs).concat(rawArgs));
};

if (require.main === module) {
  var result = gitlet(process.argv);
  if (result !== undefined) {
    console.log(result);
  }
}
