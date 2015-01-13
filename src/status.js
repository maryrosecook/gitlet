var fs = require("fs");
var refs = require("./refs");
var files = require("./files");
var index = require("./index");
var diff = require("./diff");
var objects = require("./objects");

var status = module.exports = {
  toString: function() {
    function currentBranch() {
      return ["On branch " + refs.headBranchName()];
    };

    function untracked() {
      var paths = fs.readdirSync(files.workingCopyPath())
          .filter(function(p) { return index.toc()[p] === undefined && p !== ".gitlet"; });
      return paths.length > 0 ? ["Untracked files:"].concat(paths) : [];
    };

    function conflicted() {
      var paths = index.conflictedPaths();
      return paths.length > 0 ? ["Unmerged paths:"].concat(paths) : [];
    };

    function toBeCommitted() {
      var headHash = refs.hash("HEAD");
      var headToc = headHash === undefined ? {} : objects.commitToc(headHash);
      var ns = diff.nameStatus(diff.tocDiff(headToc, index.toc()));
      var entries = Object.keys(ns).map(function(p) { return ns[p] + " " + p; });
      return entries.length > 0 ? ["Changes to be committed:"].concat(entries) : [];
    };

    function notStagedForCommit() {
      var ns = diff.nameStatus(diff.diff());
      var entries = Object.keys(ns).map(function(p) { return ns[p] + " " + p; });
      return entries.length > 0 ? ["Changes not staged for commit:"].concat(entries) : [];
    };

    return [currentBranch(),
            untracked(),
            conflicted(),
            toBeCommitted(),
            notStagedForCommit()]
      .reduce(function(a, section) {
        return section.length > 0 ? a.concat(section, "") : a;
      }, [])
      .join("\n");
  }
};
