var fs = require('fs');
var nodePath = require('path');
var files = require('./files');
var objects = require('./objects');
var util = require('./util');

var index = module.exports = {
  readHasFile: function(path) {
    return index.read()[path] !== undefined;
  },

  read: function() {
    var indexFilePath = nodePath.join(files.gitletDir(), "index");
    return util.lines(fs.existsSync(indexFilePath) ? files.read(indexFilePath) : "")
      .reduce(function(idx, blobStr) {
        var blobData = blobStr.split(/ /);
        idx[blobData[0]] = blobData[1];
        return idx;
      }, {});
  },

  writeFile: function(path) {
    var idx = index.read();
    idx[path] = objects.write(files.read(nodePath.join(files.repoDir(), path)));
    index.write(idx);
  },

  write: function(index) {
    var indexStr = Object.keys(index)
        .map(function(path) { return path + " " + index[path]; })
        .join("\n") + "\n";
    files.write(nodePath.join(files.gitletDir(), "index"), indexStr);
  },

  readWorkingCopyIndex: function() {
    return Object.keys(index.read())
      .filter(function(path) { return fs.existsSync(nodePath.join(files.repoDir(), path)); })
      .reduce(function(idx, path) {
        idx[path] = util.hash(files.read(nodePath.join(files.repoDir(), path)));
        return idx;
      }, {});
  }
};
