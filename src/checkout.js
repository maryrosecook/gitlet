var fs = require('fs');
var index = require('./index');
var files = require('./files');
var objects = require('./objects');
var diff = require('./diff');

var checkout = module.exports = {
  readChangedFilesCheckoutWouldOverwrite: function(checkoutHash) {
    var localChanges = diff.readDiff("HEAD");
    var headToBranchChanges = diff.readDiff("HEAD", checkoutHash);
    return Object.keys(localChanges)
      .filter(function(path) { return path in headToBranchChanges; });
  },

  writeCheckout: function(checkoutHash) {
    var checkoutIndex = index.readCommitIndex(checkoutHash);
    var changes = diff.readDiff("HEAD", checkoutHash);
    Object.keys(changes).forEach(function(path) {
      if (changes[path] === diff.FILE_STATUS.ADD ||
          changes[path] === diff.FILE_STATUS.MODIFY) { // no line by line for now
        files.write(nodePath.join(files.gitletDir(), path), objects.read(checkoutIndex[path]));
      } else if (changes[path] === diff.FILE_STATUS.DELETE) {
        fs.unlinkSync(path);
      }
    });
  }
};
