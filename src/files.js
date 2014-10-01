var fs = require('fs');
var nodePath = require('path');
var util = require('./util');

var files = module.exports = {
  gitletDir: function(dir) {
    if (dir === undefined) { return files.gitletDir(process.cwd()); }

    if (fs.existsSync(dir)) {
      var potentialGitletDir = nodePath.join(dir, ".gitlet");
      if (fs.existsSync(potentialGitletDir)) {
        return potentialGitletDir;
      } else if (dir !== "/") {
        return files.gitletDir(nodePath.join(dir, ".."));
      }
    }
  },

  repoDir: function() {
    if (files.gitletDir() !== undefined) {
      return nodePath.join(files.gitletDir(), "..")
    }
  },

  inRepo: function(cwd) {
    return files.gitletDir(cwd) !== undefined;
  },

  assertInRepo: function() {
    if (!files.inRepo()) {
      throw "fatal: Not a gitlet repository (or any of the parent directories): .gitlet";
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
        if (!fs.existsSync(path)) {
          fs.mkdirSync(path, "777");
        }

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
