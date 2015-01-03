// var diff = require("./diff");
var fs = require("fs");
var refs = require("./refs");
var files = require("./files");
var index = require("./index");

var status = module.exports = {
  toString: function() {
    return [readCurrentBranch(),
            readUntracked()]
      .reduce(function(a, section) {
        return section.length > 0 ? a.concat(section, "") : a;
      }, [])
      .join("\n");
  }
};

function readCurrentBranch() {
  return ["On branch " + refs.readHeadBranchName()];
};

function readUntracked() {
  var paths = fs.readdirSync(files.workingCopyPath())
      .filter(function(p) { return index.readToc()[p] === undefined && p !== ".gitlet"; });
  return paths.length > 0 ? ["Untracked files:"].concat(paths) : [];
};
