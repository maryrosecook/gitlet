var refs = require("./refs");
var objects = require("./objects");
var config = require("./config");

var remote = module.exports = {
  readRemoteObjects: function(remoteName) {
    return remote.runIn(remoteName, function() {
      return objects.readAllHashes().map(objects.read);
    });
  },

  readRemoteHeads: function(remoteName) {
    return remote.runIn(remoteName, refs.readLocalHeads);
  },

  readIsCheckedOut: function(remoteName, branchName) {
    return remote.runIn(remoteName, function() {
      return refs.readIsCheckedOut(branchName);
    });
  },
  runIn: function(remoteName, fn) {
    var originalDir = process.cwd();
    process.chdir(config.read().remote[remoteName].url);

    var result = fn();
    process.chdir(originalDir);
    return result;
  }
};
