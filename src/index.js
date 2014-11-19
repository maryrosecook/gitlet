var fs = require("fs");
var nodePath = require("path");
var files = require("./files");
var objects = require("./objects");
var util = require("./util");

var index = module.exports = {
  readHasFile: function(path) {
    return index.read()[path] !== undefined;
  },

  read: function() {
    var indexFilePath = nodePath.join(files.gitletDir(), "index");
    return util.lines(fs.existsSync(indexFilePath) ? files.read(indexFilePath) : "\n")
      .reduce(function(idx, blobStr) {
        var blobData = blobStr.split(/ /);
        idx[blobData[0]] = { stage: parseInt(blobData[1]), hash: blobData[2] };
        return idx;
      }, {});
  },

  writeFile: function(path) {
    var idx = index.read();
    idx[path] = {
      stage: 1,
      hash: objects.write(files.read(nodePath.join(files.repoDir(), path)))
    };

    index.write(idx);
  },

  removeFile: function(path) {
    var idx = index.read();
    delete idx[path];
    index.write(idx);
  },

  write: function(index) {
    var indexStr = Object.keys(index)
        .map(function(path) { return path + " " + index[path].stage + " " + index[path].hash})
        .join("\n") + "\n";
    fs.writeFileSync(nodePath.join(files.gitletDir(), "index"), indexStr);
  },

  readWorkingCopyToc: function() {
    return Object.keys(index.read())
      .filter(function(path) { return fs.existsSync(nodePath.join(files.repoDir(), path)); })
      .reduce(function(idx, path) {
        idx[path] = util.hash(files.read(nodePath.join(files.repoDir(), path)))
        return idx;
      }, {});
  },

  indexToToc: function(idx) {
    return Object.keys(idx)
      .reduce(function(obj, p) { return util.assocIn(obj, [p, idx[p].hash]); }, {});
  },

  tocToIndex: function(toc) {
    return Object.keys(toc)
      .reduce(function(idx, p) {
        return util.assocIn(idx, [p, { stage: 1, hash: toc[p] }]);
      }, {});
  }
};
