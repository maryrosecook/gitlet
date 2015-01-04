var fs = require("fs");
var refs = require("./refs");
var files = require("./files");
var index = require("./index");
var diff = require("./diff");
var objects = require("./objects");

var status = module.exports = {
  toString: function() {
    return [readCurrentBranch(),
            readUntracked(),
            readConflicted(),
            readToBeCommitted(),
            readNotStagedForCommit()]
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
  if (refs.readHash("HEAD") === undefined) { return []; }
  var ns = diff.nameStatus(diff.diff(objects.readCommitToc(refs.readHash("HEAD")),
                                     index.readToc()));
  var entries = Object.keys(ns).map(function(p) { return ns[p] + " " + p; });
  return entries.length > 0 ? ["Changes to be committed:"].concat(entries) : [];
};

function readNotStagedForCommit() {
  var ns = diff.nameStatus(diff.readHashDiff());
  var entries = Object.keys(ns).map(function(p) { return ns[p] + " " + p; });
  return entries.length > 0 ? ["Changes not staged for commit:"].concat(entries) : [];
};
