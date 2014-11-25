var fs = require("fs");
var nodePath = require("path");
var index = require("./index");
var files = require("./files");
var objects = require("./objects");
var refs = require("./refs");
var diff = require("./diff");
var util = require("./util");

var checkout = module.exports = {
  writeWorkingCopy: function(fromHash, toHash) {
    var changes = diff.readDiff(fromHash, toHash);
    var checkoutIndex = objects.readCommitToc(toHash);
    Object.keys(changes).forEach(function(path) {
      if (changes[path] === diff.FILE_STATUS.ADD ||
          changes[path] === diff.FILE_STATUS.MODIFY) { // no line by line for now
        files.write(nodePath.join(files.repoDir(), path), objects.read(checkoutIndex[path]));
      } else if (changes[path] === diff.FILE_STATUS.DELETE) {
        fs.unlinkSync(path);
      }
    });

    fs.readdirSync(files.repoDir())
      .filter(function(dirChild) { return dirChild !== ".gitlet"; })
      .forEach(files.deleteEmptyDirs);
  }
};
