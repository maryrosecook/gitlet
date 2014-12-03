var fs = require("fs");
var nodePath = require("path");
var files = require("./files");
var objects = require("./objects");
var util = require("./util");

var index = module.exports = {
  readHasFile: function(path, stage) {
    return index.read()[index.key(path, stage)] !== undefined;
  },

  read: function() {
    var indexFilePath = files.gitletPath("index");
    return util.lines(fs.existsSync(indexFilePath) ? files.read(indexFilePath) : "\n")
      .reduce(function(idx, blobStr) {
        var blobData = blobStr.split(/ /);
        idx[index.key(blobData[0], blobData[1])] = blobData[2];
        return idx;
      }, {});
  },

  key: function(path, stage) {
    return path + "," + stage;
  },

  readToc: function() {
    var idx = index.read();
    return Object.keys(idx)
      .reduce(function(obj, k) { return util.assocIn(obj, [k.split(",")[0], idx[k]]); }, {});
  },

  writeFileContent: function(path, stage, content) {
    var idx = index.read();
    idx[index.key(path, stage)] = objects.write(content);
    index.write(idx);
  },

  removeFile: function(path, stage) {
    var idx = index.read();
    delete idx[index.key(path, stage)];
    index.write(idx);
  },

  write: function(index) {
    var indexStr = Object.keys(index)
        .map(function(k) { return k.split(",")[0] + " " + k.split(",")[1] + " " + index[k] })
        .join("\n") + "\n";
    files.write(files.gitletPath("index"), indexStr);
  },

  readWorkingCopyToc: function() {
    return Object.keys(index.read())
      .map(function(k) { return k.split(",")[0]; })
      .filter(function(p) { return fs.existsSync(nodePath.join(files.repoDir(), p)); })
      .reduce(function(idx, p) {
        idx[p] = util.hash(files.read(files.repoPath(p)))
        return idx;
      }, {});
  },

  tocToIndex: function(toc) {
    return Object.keys(toc)
      .reduce(function(idx, p) { return util.assocIn(idx, [index.key(p, 0), toc[p]]); }, {});
  }
};
