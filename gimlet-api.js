var fs = require('fs');
var pathLib = require('path');

var gimlet = module.exports = {
  init: function() {
    if (inRepo()) return;

    createFileTree({
      ".gimlet": {
        HEAD: "ref: refs/heads/master\n",
        index: "",
        hooks: {},
        info: {},
        logs: {},
        objects: {},
        refs: {
          heads: {},
          remotes: {
            origin: {}
          },
          tags: {}
        }
      }
    });
  },

  add: function(path) {
    assertInRepo();

    if (typeof path === 'string') {
      var files = index.getWorkingCopyPathsFrom(path);
      if (files.length === 0) {
        throw "fatal: pathspec '" + pathFromRepoRoot(path) + "' did not match any files";
      }
    } else {
      throw "Nothing specified, nothing added.";
    }
  },

  update_index: function(path, opts) {
    assertInRepo();
    opts = opts || {};

    if (typeof path === 'string') {
      var pathFromRoot = pathFromRepoRoot(path)
      if (!fs.existsSync(path)) {
        throw "error: " + pathFromRoot + ": does not exist\n" +
          "fatal: Unable to process path " + pathFromRoot;
      } else if (fs.statSync(path).isDirectory()) {
        throw "error: " + pathFromRoot + ": is a directory - add files inside instead\n" +
          "fatal: Unable to process path " + pathFromRoot;
      } else if (!index.hasFile(path) && opts.add === undefined) {
        throw "error: " + pathFromRoot  +
          ": cannot add to the index - missing --add option?\n" +
          "fatal: Unable to process path " + pathFromRoot;
      } else {
        index.addFile(path);
      }
    }
  },

  hash_object: function(file, opts) {
    assertInRepo();
    opts = opts || {};

    if (file !== undefined) {
      if (!fs.existsSync(file)) {
        throw "fatal: Cannot open '" + file + "': No such file or directory"
      } else {
        var fileContents = fs.readFileSync(file, "utf8");
        if (opts.w) {
          writeObject(fileContents);
        }

        return hash(fileContents);
      }
    }
  },

  ls_files: function(opts) {
    assertInRepo();
    opts = opts || {};

    var indexObjs = index.get();
    if (opts.stage) {
      return Object.keys(indexObjs)
        .map(function(path) { return path + " " + indexObjs[path]; });
    } else {
      return Object.keys(indexObjs);
    }
  }
};

var index = {
  hasFile: function(path) {
    return index.get()[path] !== undefined;
  },

  addFile: function(path) {
    var index = this.get();
    index[path] = hash(fs.readFileSync(pathLib.join(getRepoDir(), path), "utf8"));
    gimlet.hash_object(path, { w: true });
    this.set(index);
  },

  get: function() {
    return fs.readFileSync(pathLib.join(getGimletDir(), "index"), "utf8")
      .split("\n")
      .slice(0, -1) // chuck last empty line
      .reduce(function(index, blobStr) {
        var blobData = blobStr.split(/ /);
        index[blobData[0]] = blobData[1];
        return index;
      }, {});
  },

  set: function(index) {
    var indexStr = Object.keys(index)
        .map(function(path) { return path + " " + index[path]; })
        .join("\n")
        .concat("\n"); // trailing new line
    fs.writeFileSync(pathLib.join(getGimletDir(), "index"), indexStr);
  },

  getWorkingCopyPathsFrom: function(path) {
    if (!fs.existsSync(path)) {
      return [];
    } else if (fs.statSync(path).isFile()) {
      return path;
    } else if (fs.statSync(path).isDirectory()) {
      return fs.readdirSync(path).map(function(dirChild) {
        return getWorkingCopyPathsFrom(pathLib.join(dir, dirChild));
      });
    }
  }
};

var writeObject = function(content) {
  var filePath = pathLib.join(getGimletDir(), "objects", hash(content));
  fs.writeFileSync(filePath, content);
};

var hash = function(string) {
  return string
    .split("")
    .map(function(c) { return c.charCodeAt(0); })
    .reduce(function(a, n) { return a + n; })
    .toString(16);
};

var getGimletDir = function(dir) {
  if (dir === undefined) return getGimletDir(process.cwd());
  if (fs.existsSync(dir)) {
    var gimletDir = pathLib.join(dir, ".gimlet");
    if (fs.existsSync(gimletDir)) {
      return gimletDir;
    } else if (dir !== "/") {
      return getGimletDir(pathLib.join(dir, ".."));
    }
  }
};

var getRepoDir = function() {
  if (getGimletDir() !== undefined) {
    return pathLib.join(getGimletDir(), "..")
  }
};

var inRepo = function(cwd) {
  return getGimletDir(cwd) !== undefined;
};

var assertInRepo = function() {
  if (!inRepo()) {
    throw "fatal: Not a gimlet repository (or any of the parent directories): .gimlet";
  }
};

var pathFromRepoRoot = function(path) {
  return pathLib.relative(getRepoDir(), pathLib.join(process.cwd(), path));
};

var createFileTree = function(structure, prefix) {
  if (prefix === undefined) return createFileTree(structure, process.cwd());

  Object.keys(structure).forEach(function(name) {
    var path = pathLib.join(prefix, name);
    if (typeof structure[name] === "string") {
      fs.writeFileSync(path, structure[name]);
    } else {
      fs.mkdirSync(path, "777");
      createFileTree(structure[name], path);
    }
  });
};
