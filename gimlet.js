var gimletApi = require('./gimlet-api');
var parseOptions = require('./parse-options');

var gimlet = module.exports = function(argv) {
  var rawArgs = parseOptions(argv);
  var command = rawArgs._[2].replace(/-/g, "_");
  var commandArgs = rawArgs._.slice(3);
  return gimletApi[command].apply(gimletApi, commandArgs.concat(rawArgs));
};

if (require.main === module) {
  var result = gimlet(process.argv);
  if (result !== undefined) {
    console.log(result);
  }
}
