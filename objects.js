var fs = require('fs');
var nodePath = require('path');
var files = require('./files');
var util = require('./util');

var objects = module.exports = {
  writeTree: function(tree) {
    var treeObject = Object.keys(tree).map(function(key) {
      if (util.isString(tree[key])) {
        return "blob " + util.hash(tree[key]) + " " + key;
      } else {
        return "tree " + objects.writeTree(tree[key]) + " " + key;
      }
    }).join("\n") + "\n";

    return objects.write(treeObject);
  },

  composeCommit: function(treeHash, message, parentHashes) {
    return "commit " + treeHash + "\n" +
      parentHashes.map(function(h) { return "parent " + h + "\n"; }).join("") +
      "Date:  " + new Date().toString() + "\n" +
      "\n" +
      "    " + message;
  },

  write: function(str) {
    var contentHash = util.hash(str);
    if (objects.read(contentHash) === undefined) {
      var filePath = nodePath.join(files.gimletDir(), "objects", contentHash);
      files.write(filePath, str);
    }

    return contentHash;
  },

  readExists: function(objectHash) {
    return objectHash !== undefined &&
      fs.existsSync(nodePath.join(files.gimletDir(), "objects", objectHash));
  },

  read: function(objectHash) {
    if (objectHash !== undefined) {
      var objectPath = nodePath.join(files.gimletDir(), "objects", objectHash);
      if (fs.existsSync(objectPath)) {
        return files.read(objectPath);
      }
    }
  },

  type: function(str) {
    var firstToken = str.split(" ")[0];
    if (firstToken === "commit") {
      return "commit";
    } else if (firstToken === "tree" || firstToken === "blob") {
      return "tree";
    } else {
      return "blob";
    }
  },

  treeHash: function(str) {
    if (objects.type(str) === "commit") {
      return str.split(/\s/)[1];
    } else if (objects.type(str) === "tree") {
      return util.hash(str);
    }
  }
};
