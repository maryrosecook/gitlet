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
    var localChanges = diff.readDiff("HEAD");
    var headToBranchChanges = diff.readDiff("HEAD", checkoutHash);
    return Object.keys(localChanges)
      .filter(function(path) { return path in headToBranchChanges; });
  },

  writeCheckout: function(ref) {
    addModifyDelete("HEAD", refs.readHash(ref));
    fs.readdirSync(files.repoDir())
      .filter(function(dirChild) { return dirChild !== ".gitlet"; })
      .filter(function(dirChild) { return fs.statSync(dirChild).isDirectory(); })
      .forEach(files.deleteEmptyDirs);

    refs.writeLocal("HEAD", objects.readExists(ref) ? ref : "ref: " + refs.nameToBranchRef(ref));
  }
};

function addModifyDelete(diffFromRef, diffToRef) {
  var changes = diff.readDiff(diffFromRef, diffToRef);
  var checkoutIndex = index.readCommitIndex(diffToRef);
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
};
