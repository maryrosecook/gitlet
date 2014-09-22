var fs = require('fs');
var nodePath = require('path');
var files = require('./files');
var objects = require('./objects');
var util = require('./util');

var index = module.exports = {
  readHasFile: function(path) {
    return index.strToObj(index.read())[path] !== undefined;
  },

  read: function() {
    var path = nodePath.join(files.gimletDir(), "index");
    return fs.existsSync(path) ? files.read(path) : "";
  },

  writeFile: function(path) {
    var idx = index.strToObj(index.read());
    idx[path] = objects.write(files.read(nodePath.join(files.repoDir(), path)));
    index.write(idx);
  },

  strToObj: function(str) { // CHUCK THIS WHEN REFACTOR DONE
    return util.lines(str)
      .reduce(function(idx, blobStr) {
        var blobData = blobStr.split(/ /);
        idx[blobData[0]] = blobData[1];
        return idx;
      }, {});
  },

  write: function(index) {
    var indexStr = Object.keys(index)
        .map(function(path) { return path + " " + index[path]; })
        .join("\n") + "\n";
    files.write(nodePath.join(files.gimletDir(), "index"), indexStr);
  },

  objToTree: function(obj) {
    var tree = {};
    Object.keys(obj).forEach(function(wholePath) {
      util.assocIn(tree, wholePath.split(nodePath.sep).concat(files.read(wholePath)));
    });

    return tree;
  }
};
