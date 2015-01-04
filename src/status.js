var fs = require("fs");
var refs = require("./refs");
var files = require("./files");
var index = require("./index");
var diff = require("./diff");

var status = module.exports = {
  toString: function() {
    return [readCurrentBranch(),
            readUntracked(),
            readConflicted(),
            readToBeCommitted()]
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

function readConflicted() {
  var paths = index.readConflictedPaths();
  return paths.length > 0 ? ["Unmerged paths:"].concat(paths) : [];
};

function readToBeCommitted() {
  var d = diff.readDiff(refs.readHash("HEAD"));
  var paths = Object.keys(d).map(function(p) { return d[p] + " " + p; });
  return paths.length > 0 ? ["Changes to be committed:"].concat(paths) : [];
};
