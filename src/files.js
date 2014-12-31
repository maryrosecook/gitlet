var fs = require("fs");
var nodePath = require("path");
var util = require("./util");

var files = module.exports = {
  inRepo: function(cwd) {
    return gitletDir(cwd) !== undefined;
  },

  assertInRepo: function() {
    if (!files.inRepo()) {
      throw new Error("error: not a Gitlet repository");
    }
  },

  pathFromRepoRoot: function(path) {
    return nodePath.relative(files.workingCopyPath(), nodePath.join(process.cwd(), path));
  },

  write: function(path, content) {
    files.writeFilesFromTree(util.assocIn({}, path.split(nodePath.sep).concat(content)), "/");
  },

  writeFilesFromTree: function(tree, prefix) {
    Object.keys(tree).forEach(function(name) {
      var path = nodePath.join(prefix, name);
      if (util.isString(tree[name])) {
        fs.writeFileSync(path, tree[name]);
      } else {
        if (!fs.existsSync(path)) {
          fs.mkdirSync(path, "777");
        }

        files.writeFilesFromTree(tree[name], path);
      }
    });
  },

  rmEmptyDirs: function(path) {
    if (fs.statSync(path).isDirectory()) {
      fs.readdirSync(path).forEach(function(c) { files.rmEmptyDirs(nodePath.join(path, c)); });
      if (fs.readdirSync(path).length === 0) {
        fs.rmdirSync(path);
      }
    }
  },

  read: function(path) {
    if (fs.existsSync(path)) {
      return fs.readFileSync(path, "utf8");
    }
  },

  gitletPath: function(path) {
    return nodePath.join(gitletDir(), path || "");
  },

  workingCopyPath: function(path) {
    return nodePath.join(workingCopyDir(), path || "");
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

function gitletDir(dir) {
  if (dir === undefined) { return gitletDir(process.cwd()); }

  if (fs.existsSync(dir)) {
    var potentialConfigFile = nodePath.join(dir, "config");
    var potentialGitletPath = nodePath.join(dir, ".gitlet");
    if (fs.existsSync(potentialConfigFile) &&
        files.read(potentialConfigFile).match(/\[core\]/)) {
      return dir;
    } else if (fs.existsSync(potentialGitletPath)) {
      return potentialGitletPath;
    } else if (dir !== "/") {
      return gitletDir(nodePath.join(dir, ".."));
    }
  }
};

function workingCopyDir() {
  if (gitletDir() !== undefined) {
    return nodePath.join(gitletDir(), "..")
  }
};
