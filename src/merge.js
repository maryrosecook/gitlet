var objects = require("./objects");
var index = require("./index");
var files = require("./files");
var diff = require("./diff");
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

  readMergeTocDiff: function(receiverHash, giverHash) {
    var receiver = objects.readCommitToc(receiverHash);
    var base = objects.readCommitToc(merge.readCommonAncestor(receiverHash, giverHash));
    var giver = objects.readCommitToc(giverHash);
    return diff.diffTocs(receiver, base, giver);
  },

  composeMergeTree: function(receiverHash, giverHash) {
    var mergeDiff = merge.readMergeTocDiff(receiverHash, giverHash);
    var mergedTree = Object.keys(mergeDiff)
      .reduce(function(idx, p) {
        if (mergeDiff[p].status === diff.FILE_STATUS.MODIFY) {
          idx[p] = composeConflict(objects.read(mergeDiff[p].receiver),
                                   objects.read(mergeDiff[p].giver),
                                   "HEAD",
                                   giverHash);
        } else if (mergeDiff[p].status === diff.FILE_STATUS.ADD ||
                   mergeDiff[p].status === diff.FILE_STATUS.SAME) {
          idx[p] = mergeDiff[p].receiver || mergeDiff[p].giver;
        }

        return idx;
      }, {});

    return files.nestFlatTree(mergedTree);
  }
};
