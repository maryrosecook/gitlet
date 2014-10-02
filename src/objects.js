var fs = require('fs');
var nodePath = require('path');
var files = require('./files');
var util = require('./util');

var objects = module.exports = {
  writeTree: function(tree) {
    var treeObject = Object.keys(tree).map(function(key) {
      if (util.isString(tree[key])) {
        return "blob " + tree[key] + " " + key;
      } else {
        return "tree " + objects.writeTree(tree[key]) + " " + key;
      }
    }).join("\n") + "\n";

    return objects.write(treeObject);
  },

  readTree: function(treeHash, tree) {
    if (tree === undefined) { return objects.readTree(treeHash, {}); }

    util.lines(objects.read(treeHash)).forEach(function(line) {
      var lineTokens = line.split(/ /);
      tree[lineTokens[2]] = lineTokens[0] === "tree" ?
        objects.readTree(lineTokens[1], {}) :
        tree[lineTokens[2]] = lineTokens[1];
    });

    return tree;
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
    if (!objects.readExists(contentHash)) {
      var filePath = nodePath.join(files.gitletDir(), "objects", contentHash);
      fs.writeFileSync(filePath, str);
    }

    return contentHash;
  },

  readExists: function(objectHash) {
    return objectHash !== undefined &&
      fs.existsSync(nodePath.join(files.gitletDir(), "objects", objectHash));
  },

  read: function(objectHash) {
    if (objectHash !== undefined) {
      var objectPath = nodePath.join(files.gitletDir(), "objects", objectHash);
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
    }
  }
};
