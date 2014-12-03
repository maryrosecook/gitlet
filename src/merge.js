var nodePath = require("path");
var objects = require("./objects");
var index = require("./index");
var files = require("./files");
var diff = require("./diff");
var refs = require("./refs");
var util = require("./util");

var merge = module.exports = {
  readCommonAncestor: function(aHash, bHash) {
    var sorted = [aHash, bHash].sort();
    aHash = sorted[0];
    bHash = sorted[1];
    var aAncestors = [aHash].concat(objects.readAncestors(aHash));
    var bAncestors = [bHash].concat(objects.readAncestors(bHash));
    return util.intersection(aAncestors, bAncestors)[0];
  },

  readIsMergeInProgress: function() {
    return refs.readHash("MERGE_HEAD");
  },

  readCanFastForward: function(receiverHash, giverHash) {
    return objects.readIsAncestor(giverHash, receiverHash);
  },

  readHasConflicts: function(receiverHash, giverHash) {
    var mergeDiff = merge.readMergeDiff(receiverHash, giverHash);
    return Object.keys(mergeDiff)
      .filter(function(p) { return mergeDiff[p].status===diff.FILE_STATUS.MODIFY }).length > 0;
  },

  readMergeDiff: function(receiverHash, giverHash) {
    var receiver = objects.readCommitToc(receiverHash);
    var base = objects.readCommitToc(merge.readCommonAncestor(receiverHash, giverHash));
    var giver = objects.readCommitToc(giverHash);
    return diff.diffWithBase(receiver, base, giver);
  },

  writeMergeMsg: function(receiverHash, giverHash, ref) {
    var msg = "Merge " + ref + " into " + refs.readCurrentBranchName();

    var mergeDiff = merge.readMergeDiff(receiverHash, giverHash);
    var conflicts = Object.keys(mergeDiff)
        .filter(function(p) { return mergeDiff[p].status === diff.FILE_STATUS.MODIFY });
    if (conflicts.length > 0) {
      msg += "\nConflicts:\n" + conflicts.join("\n");
    }

    files.write(files.gitletPath("MERGE_MSG"), msg);
  },

  writeIndex: function(receiverHash, giverHash) {
    var mergeDiff = merge.readMergeDiff(receiverHash, giverHash);
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
