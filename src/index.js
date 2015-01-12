var fs = require("fs");
var nodePath = require("path");
var files = require("./files");
var objects = require("./objects");
var util = require("./util");

var index = module.exports = {
  hasFile: function(path, stage) {
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

  keyPieces: function(key) {
    var pieces = key.split(/,/);
    return { path: pieces[0], stage: parseInt(pieces[1]) };
  },

  toc: function() {
    var idx = index.read();
    return Object.keys(idx)
      .reduce(function(obj, k) { return util.assocIn(obj, [k.split(",")[0], idx[k]]); }, {});
  },

  isFileInConflict: function(path) {
    return index.hasFile(path, 2);
  },

  conflictedPaths: function() {
    var idx = index.read();
    return Object.keys(idx)
      .filter(function(k) { return index.keyPieces(k).stage === 2; })
      .map(function(k) { return index.keyPieces(k).path; });
  },

  writeAdd: function(path) {
    if (index.isFileInConflict(path)) {
      index.rmEntry(path, 1);
      index.rmEntry(path, 2);
      index.rmEntry(path, 3);
    }

    index.writeEntry(path, 0, files.read(files.workingCopyPath(path)));
  },

  writeRm: function(path) {
    index.rmEntry(path, 0);
  },

  writeEntry: function(path, stage, content) {
    var idx = index.read();
    idx[index.key(path, stage)] = objects.write(content);
    index.write(idx);
  },

  rmEntry: function(path, stage) {
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

  workingCopyToc: function() {
    return Object.keys(index.read())
      .map(function(k) { return k.split(",")[0]; })
      .filter(function(p) { return fs.existsSync(files.workingCopyPath(p)); })
      .reduce(function(idx, p) {
        idx[p] = util.hash(files.read(files.workingCopyPath(p)))
        return idx;
      }, {});
  },

  tocToIndex: function(toc) {
    return Object.keys(toc)
      .reduce(function(idx, p) { return util.assocIn(idx, [index.key(p, 0), toc[p]]); }, {});
  },

  matchingFiles: function(pathSpec) {
    var prefix = nodePath.relative(files.workingCopyPath(), process.cwd());
    var searchPath = nodePath.join(prefix, pathSpec);
    return Object.keys(index.toc())
      .filter(function(p) { return p.match("^" + searchPath); });
  }
};
