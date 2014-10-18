var fs = require("fs");
var nodePath = require("path");
var index = require("./index");
var files = require("./files");
var objects = require("./objects");
var refs = require("./refs");
var diff = require("./diff");
var util = require("./util");

var checkout = module.exports = {
  readChangedFilesCheckoutWouldOverwrite: function(checkoutHash) {
    var headHash = refs.readHash("HEAD");
    var localChanges = diff.readDiff(headHash);
    var headToBranchChanges = diff.readDiff(headHash, checkoutHash);
    return Object.keys(localChanges)
      .filter(function(path) { return path in headToBranchChanges; });
  },

  writeWorkingCopy: function(fromHash, toHash) {
    var changes = diff.readDiff(fromHash, toHash);
    var checkoutIndex = index.readCommitIndex(toHash);
    Object.keys(changes).forEach(function(path) {
      if (changes[path] === diff.FILE_STATUS.ADD ||
          changes[path] === diff.FILE_STATUS.MODIFY) { // no line by line for now
          var content = objects.read(checkoutIndex[path]);
        files.writeFilesFromTree(util.assocIn({}, path.split(nodePath.sep).concat(content)),
                                 files.repoDir());
      } else if (changes[path] === diff.FILE_STATUS.DELETE) {
        fs.unlinkSync(path);
      }
    });

    fs.readdirSync(files.repoDir())
      .filter(function(dirChild) { return dirChild !== ".gitlet"; })
      .filter(function(dirChild) { return fs.statSync(dirChild).isDirectory(); })
      .forEach(files.deleteEmptyDirs);
  },

  writeIndex: function(hash) {
    index.write(index.readCommitIndex(hash));
  }
};
