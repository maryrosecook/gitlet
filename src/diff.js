var files = require("./files");
var index = require("./index");
var objects = require("./objects");
var refs = require("./refs");
var util = require("./util");

var diff = module.exports = {
  FILE_STATUS: { ADD: "A", MODIFY: "M", DELETE: "D", SAME: "SAME" },

  readDiff: function(hash1, hash2) {
    if (hash1 === undefined && hash2 === undefined) {
      return diff.nameStatus(index.read(), index.readWorkingCopyIndex());
    } else if (hash2 === undefined) {
      return diff.nameStatus(index.readCommitIndex(hash1), index.readWorkingCopyIndex());
    } else {
      return diff.nameStatus(index.readCommitIndex(hash1), index.readCommitIndex(hash2));
    }
  },

  nameStatus: function(receiver, giver) {
    var indexDiff = diff.diffIndices(receiver, receiver, giver);
    return Object.keys(indexDiff)
      .filter(function(p) { return indexDiff[p] !== diff.FILE_STATUS.SAME; })
      .reduce(function(ns, p) { return util.assocIn(ns, [p, indexDiff[p]]); }, {});
  },

  fileStatus: function(receiver, base, giver) {
    var receiverPresent = receiver !== undefined;
    var basePresent = base !== undefined;
    var giverPresent = giver !== undefined;
    if (receiverPresent && giverPresent && receiver !== giver) {
      return diff.FILE_STATUS.MODIFY;
    } else if (receiver === giver) {
      return diff.FILE_STATUS.SAME;
    } else if ((!receiverPresent && !basePresent && giverPresent) ||
               (receiverPresent && !basePresent && !giverPresent)) {
      return diff.FILE_STATUS.ADD;
    } else if ((receiverPresent && basePresent && !giverPresent) ||
               (!receiverPresent && basePresent && giverPresent)) {
      return diff.FILE_STATUS.DELETE;
    }
  },

  diffIndices: function(receiver, base, giver) {
    var paths = Object.keys(receiver).concat(Object.keys(base)).concat(Object.keys(giver));
    return util.unique(paths).reduce(function(idx, p) {
      return util.assocIn(idx, [p, diff.fileStatus(receiver[p], base[p], giver[p])]);
    }, {});
  },

  readChangedFilesCommitWouldOverwrite: function(hash) {
    var headHash = refs.readHash("HEAD");
    var localChanges = diff.readDiff(headHash);
    var headToBranchChanges = diff.readDiff(headHash, hash);
    return Object.keys(localChanges)
      .filter(function(path) { return path in headToBranchChanges; });
  },
};
