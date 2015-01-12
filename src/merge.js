var objects = require("./objects");
var index = require("./index");
var files = require("./files");
var diff = require("./diff");
var refs = require("./refs");
var workingCopy = require("./working-copy");
var util = require("./util");
var config = require("./config");

var merge = module.exports = {
  commonAncestor: function(aHash, bHash) {
    var sorted = [aHash, bHash].sort();
    aHash = sorted[0];
    bHash = sorted[1];
    var aAncestors = [aHash].concat(objects.ancestors(aHash));
    var bAncestors = [bHash].concat(objects.ancestors(bHash));
    return util.intersection(aAncestors, bAncestors)[0];
  },

  isMergeInProgress: function() {
    return refs.hash("MERGE_HEAD");
  },

  canFastForward: function(receiverHash, giverHash) {
    return receiverHash === undefined || objects.isAncestor(giverHash, receiverHash);
  },

  isForce: function(receiverHash, giverHash) {
    return receiverHash !== undefined && !objects.isAncestor(giverHash, receiverHash);
  },

  hasConflicts: function(receiverHash, giverHash) {
    var mergeDiff = merge.mergeDiff(receiverHash, giverHash);
    return Object.keys(mergeDiff)
      .filter(function(p) {return mergeDiff[p].status===diff.FILE_STATUS.CONFLICT }).length > 0
  },

  mergeDiff: function(receiverHash, giverHash) {
    return diff.tocDiff(objects.commitToc(receiverHash),
                        objects.commitToc(giverHash),
                        objects.commitToc(merge.commonAncestor(receiverHash, giverHash)));
  },

  writeMergeMsg: function(receiverHash, giverHash, ref) {
    var msg = "Merge " + ref + " into " + refs.headBranchName();

    var mergeDiff = merge.mergeDiff(receiverHash, giverHash);
    var conflicts = Object.keys(mergeDiff)
        .filter(function(p) { return mergeDiff[p].status === diff.FILE_STATUS.CONFLICT });
    if (conflicts.length > 0) {
      msg += "\nConflicts:\n" + conflicts.join("\n");
    }

    files.write(files.gitletPath("MERGE_MSG"), msg);
  },

  writeIndex: function(receiverHash, giverHash) {
    var mergeDiff = merge.mergeDiff(receiverHash, giverHash);
    index.write({});
    Object.keys(mergeDiff).forEach(function(p) {
      if (mergeDiff[p].status === diff.FILE_STATUS.CONFLICT) {
        if (mergeDiff[p].base !== undefined) { // (undef if same filepath ADDED w dif content)
          index.writeEntry(p, 1, objects.read(mergeDiff[p].base));
        }

        index.writeEntry(p, 2, objects.read(mergeDiff[p].receiver));
        index.writeEntry(p, 3, objects.read(mergeDiff[p].giver));
      } else if (mergeDiff[p].status === diff.FILE_STATUS.MODIFY) {
        index.writeEntry(p, 0, mergeDiff[p].giver);
      } else if (mergeDiff[p].status === diff.FILE_STATUS.ADD ||
                 mergeDiff[p].status === diff.FILE_STATUS.SAME) {
        var content = objects.read(mergeDiff[p].receiver || mergeDiff[p].giver);
        index.writeEntry(p, 0, content);
      }
    });
  },

  writeFastForwardMerge: function(receiverHash, giverHash) {
    refs.write(refs.toLocalRef(refs.headBranchName()), giverHash);
    index.write(index.tocToIndex(objects.commitToc(giverHash)));
    if (!config.isBare()) {
      var receiverToc = receiverHash === undefined ? {} : objects.commitToc(receiverHash);
      workingCopy.write(diff.tocDiff(receiverToc, objects.commitToc(giverHash)));
    }
  },

  writeNonFastForwardMerge: function(receiverHash, giverHash, giverRef) {
    refs.write("MERGE_HEAD", giverHash);
    merge.writeMergeMsg(receiverHash, giverHash, giverRef);
    merge.writeIndex(receiverHash, giverHash);
    if (!config.isBare()) {
      workingCopy.write(merge.mergeDiff(receiverHash, giverHash));
    }
  }
};
