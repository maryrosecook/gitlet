var objects = require("./objects");

var fetch = module.exports = {
  readIsForced: function(receiverHash, giverHash) {
    return receiverHash === undefined || objects.readIsAncestor(receiverHash, giverHash);
  }
};
