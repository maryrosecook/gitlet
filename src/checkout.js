var diff = require('./diff');

var checkout = module.exports = {
  readChangedFilesCheckoutWouldOverwrite: function(checkoutHash) {
    var localChanges = diff.readDiff("HEAD");
    var headToBranchChanges = diff.readDiff("HEAD", checkoutHash);
    return Object.keys(localChanges)
      .filter(function(path) { return path in headToBranchChanges; });
  }
};
