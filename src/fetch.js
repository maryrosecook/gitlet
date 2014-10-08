var objects = require("./objects");
var refs = require("./refs");
var util = require("./util");

var fetch = module.exports = {
  readAllRefHashes: function() {
    return util.flatten(util.flatten(Object.keys(refs.readLocalHeads())
                                     .map(refs.readHash)
                                     .map(objects.readGraphHashes))
                        .map(objects.readHashesRequiredForCommit))
  }
};
