var fs = require("fs");
var nodePath = require("path");
var objects = require("./objects");
var index = require("./index");
var files = require("./files");
var diff = require("./diff");
var refs = require("./refs");
var util = require("./util");

var merge = module.exports = {
  longestCommonSubsequence: util.memoize(function(a, b) {
    if (a.length === 0 || b.length === 0) {
      return [];
    } else {
      var aRemaining = a.slice(0, -1);
      var bRemaining = b.slice(0, -1);

      if (a[a.length - 1] === b[b.length - 1]) {
        return merge.longestCommonSubsequence(aRemaining, bRemaining).concat(a[a.length - 1]);
      } else {
        var aLcs = merge.longestCommonSubsequence(a, bRemaining);
        var bLcs = merge.longestCommonSubsequence(aRemaining, b);
        return aLcs.length > bLcs.length ? aLcs : bLcs;
      }
    }
  }),

  align: function(a, b, lcs, out) {
    if (lcs === undefined) {
      lcs = merge.longestCommonSubsequence(a, b);
      return merge.align(a, b, lcs, { a: [], b: [] });
    }

    if (a.length === 0 && b.length === 0) {
      return out;
    } else if (a[0] === lcs[0] && b[0] === lcs[0]) {
      out.a.push(lcs[0]);
      out.b.push(lcs[0]);
      return merge.align(a.slice(1), b.slice(1), lcs.slice(1), out);
    } else if (a[0] !== lcs[0] && b[0] !== lcs[0]) {
      out.a.push(a[0]);
      out.b.push(b[0]);
      return merge.align(a.slice(1), b.slice(1), lcs, out);
    } else if (a[0] === lcs[0]) {
      out.a.push(undefined);
      out.b.push(b[0]);
      return merge.align(a, b.slice(1), lcs, out);
    } else if (b[0] === lcs[0]) {
      out.a.push(a[0]);
      out.b.push(undefined);
      return merge.align(a.slice(1), b, lcs, out);
    }
  },

  readCommonAncestor: function(aHash, bHash) {
    var sorted = [aHash, bHash].sort();
    aHash = sorted[0];
    bHash = sorted[1];
    var aAncestors = [aHash].concat(objects.readAncestors(aHash));
    var bAncestors = [bHash].concat(objects.readAncestors(bHash));
    return util.intersection(aAncestors, bAncestors)[0];
  },

  readCanFastForward: function(receiverHash, giverHash) {
    return objects.readIsAncestor(giverHash, receiverHash);
  },

  readHasConflicts: function(receiverHash, giverHash) {
    var mergeDiff = merge.readMergeTocDiff(receiverHash, giverHash);
    return Object.keys(mergeDiff)
      .filter(function(p) { return mergeDiff[p].status===diff.FILE_STATUS.MODIFY }).length > 0;
  },

  readMergeTocDiff: function(receiverHash, giverHash) {
    var receiver = objects.readCommitToc(receiverHash);
    var base = objects.readCommitToc(merge.readCommonAncestor(receiverHash, giverHash));
    var giver = objects.readCommitToc(giverHash);
    return diff.baseDiffTocs(receiver, base, giver);
  },

  writeMergeMsg: function(receiverHash, giverHash, ref) {
    var msg = "Merge " + ref + " into " + refs.readCurrentBranchName();

    var mergeDiff = merge.readMergeTocDiff(receiverHash, giverHash);
    var conflicts = Object.keys(mergeDiff)
        .filter(function(p) { return mergeDiff[p].status === diff.FILE_STATUS.MODIFY });
    if (conflicts.length > 0) {
      msg += "\nConflicts:\n" + conflicts.join("\n");
    }

    files.write(nodePath.join(files.gitletDir(), "MERGE_MSG"), msg);
  },

  readMergeMsg: function() {
    return files.read(nodePath.join(files.gitletDir(), "MERGE_MSG"));
  },

  writeMergeIndex: function(receiverHash, giverHash) {
    var mergeDiff = merge.readMergeTocDiff(receiverHash, giverHash);
    index.write({});
    Object.keys(mergeDiff).forEach(function(p) {
      if (mergeDiff[p].status === diff.FILE_STATUS.MODIFY) {
        if (mergeDiff[p].base !== undefined) { // same filepath ADDED w dif content
          index.writeFileContent(p, 1, objects.read(mergeDiff[p].base));
        }

        index.writeFileContent(p, 2, objects.read(mergeDiff[p].receiver));
        index.writeFileContent(p, 3, objects.read(mergeDiff[p].giver));
      } else if (mergeDiff[p].status === diff.FILE_STATUS.ADD ||
                 mergeDiff[p].status === diff.FILE_STATUS.SAME) {
        var content = objects.read(mergeDiff[p].receiver || mergeDiff[p].giver);
        index.writeFileContent(p, 0, content);
      }
    });
  }
};
