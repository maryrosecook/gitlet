var files = require('./files');
var index = require('./index');
var objects = require('./objects');
var refs = require('./refs');
var util = require('./util');

var diff = module.exports = {
  FILE_STATUS: { ADD: "A", MODIFY: "M", DELETE: "D" },

  diff: function(ref1, ref2) {
    var hash1 = refs.readHash(ref1);
    var hash2 = refs.readHash(ref2);

    if (ref1 === undefined && ref2 === undefined) {
      return diff.nameStatus(index.read(), index.readWorkingCopyIndex());
    } else if (ref2 === undefined) {
      return diff.nameStatus(diff.readCommitIndex(hash1), index.readWorkingCopyIndex());
    } else {
      return diff.nameStatus(diff.readCommitIndex(hash1), diff.readCommitIndex(hash2));
    }
  },

  nameStatus: function(fromIndex, toIndex) {
    return Object.keys(fromIndex).concat(Object.keys(toIndex))
      .reduce(function(obj, path) {
        if (toIndex[path] === undefined) {
          obj[path] = diff.FILE_STATUS.DELETE;
        } else if (fromIndex[path] === undefined) {
          obj[path] = diff.FILE_STATUS.ADD;
        } else if (fromIndex[path] !== toIndex[path]) {
          obj[path] = diff.FILE_STATUS.MODIFY;
        }

        return obj;
      }, {});
  },

  readCommitIndex: function(commitHash) {
    var idxWithContent = files.flattenNestedTree(objects.readTree(objects.treeHash(
      objects.read(commitHash))));

    return Object.keys(idxWithContent).reduce(function(idxWithHashes, path) {
      idxWithHashes[path] = util.hash(idxWithContent[path]);
      return idxWithHashes;
    }, {});
  }
};
