var fs = require('fs');
var nodePath = require('path');
var util = require('./util');

var files = module.exports = {
  gimletDir: function(dir) {
    if (dir === undefined) { return files.gimletDir(process.cwd()); }

    if (fs.existsSync(dir)) {
      var potentialGimletDir = nodePath.join(dir, ".gimlet");
      if (fs.existsSync(potentialGimletDir)) {
        return potentialGimletDir;
      } else if (dir !== "/") {
        return files.gimletDir(nodePath.join(dir, ".."));
      }
    }
  },

  repoDir: function() {
    if (files.gimletDir() !== undefined) {
      return nodePath.join(files.gimletDir(), "..")
    }
  },

  inRepo: function(cwd) {
    return files.gimletDir(cwd) !== undefined;
  },

  assertInRepo: function() {
    if (!files.inRepo()) {
      throw "fatal: Not a gimlet repository (or any of the parent directories): .gimlet";
    }
  },

  pathFromRepoRoot: function(path) {
    return nodePath.relative(files.repoDir(), nodePath.join(process.cwd(), path));
  },

  writeFilesFromTree: function(structure, prefix) {
    if (prefix === undefined) {
      return files.writeFilesFromTree(structure, process.cwd());
    }

    Object.keys(structure).forEach(function(name) {
      var path = nodePath.join(prefix, name);
      if (util.isString(structure[name])) {
        files.write(path, structure[name]);
      } else {
        fs.mkdirSync(path, "777");
        files.writeFilesFromTree(structure[name], path);
      }
    });
  },

  read: function(path) {
    return fs.readFileSync(path, "utf8");
  },

  write: function(path, str) {
    fs.writeFileSync(path, str);
  },

  lsRecursive: function(path) {
    if (!fs.existsSync(path)) {
      return [];
    } else if (fs.statSync(path).isFile()) {
      return [path];
    } else if (fs.statSync(path).isDirectory()) {
      var self = this;
      return fs.readdirSync(path).reduce(function(fileList, dirChild) {
        return fileList.concat(files.lsRecursive(nodePath.join(path, dirChild)));
      }, []);
    }
  },

  nestFlatTree: function(obj) {
    var tree = {};
    Object.keys(obj).forEach(function(wholePath) {
      util.assocIn(tree, wholePath.split(nodePath.sep).concat(obj[wholePath]));
    });

    return tree;
  },

  flattenNestedTree: function(tree, obj, prefix) {
    if (obj === undefined) { return files.flattenNestedTree(tree, {}, ""); }

    Object.keys(tree).forEach(function(dir) {
      var path = nodePath.join(prefix, dir);
      if (util.isString(tree[dir])) {
        obj[path] = tree[dir];
      } else {
        files.flattenNestedTree(tree[dir], obj, path);
      }
    });

    return obj;
  }
};
