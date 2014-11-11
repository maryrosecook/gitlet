var objects = require("./objects");
var index = require("./index");
var files = require("./files");
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

  readCanFastForward: function(intoHash, fromHash) {
    return objects.readIsAncestor(fromHash, intoHash);
  },

  writeMergeTree: function(intoHash, fromHash) {
    var baseHash = merge.readCommonAncestor(intoHash, fromHash);
    var mergedIndex = merge.mergeIndices(index.readCommitIndex(intoHash),
                                         index.readCommitIndex(baseHash),
                                         index.readCommitIndex(fromHash));
    return objects.writeTree(files.nestFlatTree(mergedIndex));
  },

  mergeIndices: function(into, base, from) {
    return Object.keys(into).concat(Object.keys(base)).concat(Object.keys(from))
      .reduce(function(a, p) { return a.indexOf(p) === -1 ? a.concat(p) : a; }, [])
      .reduce(function(idx, p) {
        var intoPresent = into[p] !== undefined;
        var basePresent = base[p] !== undefined;
        var fromPresent = from[p] !== undefined;
        if (intoPresent && fromPresent && into[p] !== from[p]) {
          idx[p] = composeConflict(objects.read(into[p]),
                                   objects.read(from[p]),
                                   "HEAD",
                                   fromHash);
        } else if (into[p] === base[p] && base[p] === from[p]) {
          idx[p] = into[p];
        } else if (intoPresent && !basePresent && !fromPresent) {
          idx[p] = into[p];
        } else if (!intoPresent && !basePresent && fromPresent) {
          idx[p] = from[p];
        }

        return idx;
      }, {});
  }
};
