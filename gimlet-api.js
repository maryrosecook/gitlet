var fs = require('fs');
var pathLib = require('path');

var gimlet = module.exports = {
  init: function() {
    if (inRepo()) return;

    createFileTree({
      ".gimlet": {
        HEAD: "ref: refs/heads/master\n",
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
      var files = allFilesAt(path);
      if (files.length === 0) {
        var pathFromRoot = pathLib.relative(getRepoDir(), pathLib.join(process.cwd(), path));
        throw "fatal: pathspec '" + pathFromRoot + "' did not match any files";
      }
    } else {
      throw "Nothing specified, nothing added.";
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

var createFileTree = function(structure, prefix) {

var allFilesAt = function(path) {
  if (!fs.existsSync(path)) {
    return [];
  } else if (fs.statSync(path).isFile()) {
    return path;
  } else if (fs.statSync(path).isDirectory()) {
    return fs.readdirSync(path).map(function(dirChild) {
      return allFilesAt(pathLib.join(dir, dirChild));
    });
  } else { // some other thing - ignore
    return [];
  }
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
