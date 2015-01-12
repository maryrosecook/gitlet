var index = require("./index");
var objects = require("./objects");
var refs = require("./refs");
var util = require("./util");

var diff = module.exports = {
  FILE_STATUS: { ADD: "A", MODIFY: "M", DELETE: "D", SAME: "SAME", CONFLICT: "CONFLICT" },

  diff: function(hash1, hash2) {
    var a = hash1 === undefined ? index.toc() : objects.commitToc(hash1);
    var b = hash2 === undefined ? index.workingCopyToc() : objects.commitToc(hash2);
    return diff.tocDiff(a, b);
  },

  nameStatus: function(dif) {
    return Object.keys(dif)
      .filter(function(p) { return dif[p].status !== diff.FILE_STATUS.SAME; })
      .reduce(function(ns, p) { return util.assocIn(ns, [p, dif[p].status]); }, {});
  },

  tocDiff: function(receiver, giver, base) {
    base = base || receiver;
    var paths = Object.keys(receiver).concat(Object.keys(base)).concat(Object.keys(giver));
    return util.unique(paths).reduce(function(idx, p) {
      return util.assocIn(idx, [p, {
        status: fileStatus(receiver[p], base[p], giver[p]),
        receiver: receiver[p],
        base: base[p],
        giver: giver[p]
      }]);
    }, {});
  },

  changedFilesCommitWouldOverwrite: function(hash) {
    var headHash = refs.hash("HEAD");
    var localChanges = diff.nameStatus(diff.diff(headHash));
    var headToBranchChanges = diff.nameStatus(diff.diff(headHash, hash));
    return Object.keys(localChanges)
      .filter(function(path) { return path in headToBranchChanges; });
  },

  addedOrModifiedFiles: function() {
    var headToc = refs.hash("HEAD") ? objects.commitToc(refs.hash("HEAD")) : {};
    var wc = diff.nameStatus(diff.tocDiff(headToc, index.workingCopyToc()));
    return Object.keys(wc).filter(function(p) { return wc[p] !== diff.FILE_STATUS.DELETE; });
  }
};

function fileStatus(receiver, base, giver) {
  var receiverPresent = receiver !== undefined;
  var basePresent = base !== undefined;
  var giverPresent = giver !== undefined;
  if (receiverPresent && giverPresent && receiver !== giver) {
    if (receiver !== base && giver !== base) {
      return diff.FILE_STATUS.CONFLICT;
    } else {
      return diff.FILE_STATUS.MODIFY;
    }
  } else if (receiver === giver) {
    return diff.FILE_STATUS.SAME;
  } else if ((!receiverPresent && !basePresent && giverPresent) ||
             (receiverPresent && !basePresent && !giverPresent)) {
    return diff.FILE_STATUS.ADD;
  } else if ((receiverPresent && basePresent && !giverPresent) ||
             (!receiverPresent && basePresent && giverPresent)) {
    return diff.FILE_STATUS.DELETE;
  }
};
