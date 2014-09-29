var files = require('./files');
var objects = require('./objects');
var refs = require('./refs');
var util = require('./util');

var diff = module.exports = {
  FILE_STATUS: { ADD: "A", MODIFY: "M", DELETE: "D" },

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

  toString: function(nameToStatus) {
    return Object.keys(nameToStatus)
      .map(function(path) { return nameToStatus[path] + " " + path; })
      .join("\n") + "\n";
  },

  readCommitIndex: function(commitHash) {
    return files.flattenNestedTree(objects.readTree(objects.treeHash(
      objects.read(commitHash))));
  },
};
