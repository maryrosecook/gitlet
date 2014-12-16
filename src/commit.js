var refs = require("./refs");
var merge = require("./merge");

var commit = module.exports = {
  readParentHashes: function() {
    var headHash = refs.readHash("HEAD");
    if (merge.readIsMergeInProgress()) {
      return [headHash, refs.readHash("MERGE_HEAD")];
    } else if (headHash === undefined) {
      return [];
    } else {
      return [headHash];
    }
  }
};
