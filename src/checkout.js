var diff = require('./diff');

var checkout = module.exports = {
  readChangedFilesCheckoutWouldOverwrite: function(checkoutHash) {
    var localChanges = diff.diff("HEAD");
    var headToBranchChanges = diff.diff("HEAD", checkoutHash);
    return Object.keys(localChanges)
      .filter(function(path) { return path in headToBranchChanges; });
  }
};
