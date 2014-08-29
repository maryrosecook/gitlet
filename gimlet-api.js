var fs = require('fs');
var nodePath = require('path');

var gimlet = module.exports = {
  init: function() {
    if (directory.inRepo()) { return; }

    createFilesFromTree({
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
    directory.assertInRepo();

    if (util.isString(path)) {
      var files = index.getWorkingCopyFilesFrom(path);
      if (files.length === 0) {
        throw "fatal: pathspec '" + directory.pathFromRepoRoot(path) +
          "' did not match any files";
      } else {
        for (var i = 0; i < files.length; i++) {
          this.update_index(files[i], { add: true });
        }
      }
    } else {
      throw "Nothing specified, nothing added.";
    }
  },

  update_index: function(path, opts) {
    directory.assertInRepo();
    opts = opts || {};

    if (util.isString(path)) {
      var pathFromRoot = directory.pathFromRepoRoot(path)
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
    directory.assertInRepo();
    opts = opts || {};

    if (file !== undefined) {
      if (!fs.existsSync(file)) {
        throw "fatal: Cannot open '" + file + "': No such file or directory"
      } else {
        var fileContents = fs.readFileSync(file, "utf8");
        if (opts.w) {
          objectDatabase.writeObject(fileContents);
        }

        return hash(fileContents);
      }
    }
  },

  ls_files: function(opts) {
    directory.assertInRepo();
    opts = opts || {};

    var indexObjs = index.get();
    if (opts.stage) {
      return Object.keys(indexObjs)
        .map(function(path) { return path + " " + indexObjs[path]; });
    } else {
      return Object.keys(indexObjs);
    }
  },

  write_tree: function() {
    directory.assertInRepo();
    return objectDatabase.writeTree(index.toTree());
  },

  commit: function() {
    directory.assertInRepo();

    if (Object.keys(index.get()).length === 0) {
      throw "# On branch master\n#\n# Initial commit\n#\n" +
        "nothing to commit (create/copy files and use 'git add' to track)";
    }
  },

  branch: function(name) {
    directory.assertInRepo();
  },

  update_ref: function(ref1, ref2) {
    directory.assertInRepo();

    if (!util.isString(ref1) || !util.isString(ref2)) {
      throw "usage: see documentation"
    } else if (!refs.isValid(ref1)) {
      throw "fatal: Cannot lock the ref " + ref1 + ".";

    }
  }
};

var refs = {
  isValid: function(ref) {
    return ref === "HEAD" || ref.match("refs/heads/[A-Za-z-]+");
  },

  toFinalRef: function(ref) {
    if (ref === "HEAD") {
      return this.toFinalRef(fs.readFileSync(nodePath.join(directory.gimlet(), ref)));
    } else if (ref.match("refs/heads/[A-Za-z-]+")) {
      return ref;
    } else {
      return "refs/heads/" + ref;
    }
  },
};

var index = {
  hasFile: function(path) {
    return index.get()[path] !== undefined;
  },

  addFile: function(path) {
    var index = this.get();
    index[path] = hash(fs.readFileSync(nodePath.join(directory.repo(), path), "utf8"));
    gimlet.hash_object(path, { w: true });
    this.set(index);
  },

  get: function() {
    return fs.readFileSync(nodePath.join(directory.gimlet(), "index"), "utf8")
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
    fs.writeFileSync(nodePath.join(directory.gimlet(), "index"), indexStr);
  },

  getWorkingCopyFilesFrom: function(path) {
    if (!fs.existsSync(path)) {
      return [];
    } else if (fs.statSync(path).isFile()) {
      return path;
    } else if (fs.statSync(path).isDirectory()) {
      var self = this;
      return fs.readdirSync(path).reduce(function(files, dirChild) {
        return files.concat(self.getWorkingCopyFilesFrom(nodePath.join(path, dirChild)));
      }, []);
    }
  },

  toTree: function() {
    var tree = {};
    Object.keys(this.get()).forEach(function(wholePath) {
      (function addPathToTree(subTree, subPathParts) {
        if (subPathParts.length === 1) {
          subTree[subPathParts[0]] = fs.readFileSync(wholePath, "utf8");
        } else {
          addPathToTree(subTree[subPathParts[0]] = subTree[subPathParts[0]] || {},
                        subPathParts.slice(1));
        }
      })(tree, wholePath.split(nodePath.sep));
    });

    return tree;
  }
};

var objectDatabase = {
  writeTree: function(tree) {
    var treeObject = Object.keys(tree).map(function(key) {
      if (util.isString(tree[key])) {
        return "blob " + hash(tree[key]) + " " + key;
      } else {
        return "tree " + objectDatabase.writeTree(tree[key]) + " " + key;
      }
    }).join("\n") + "\n";

    this.writeObject(treeObject);
    return hash(treeObject);
  },

  writeObject: function(content) {
    var contentHash = hash(content);
    if (this.readObject(contentHash) === undefined) {
      var filePath = nodePath.join(directory.gimlet(), "objects", contentHash);
      fs.writeFileSync(filePath, content);
    }
  },

  readObject: function(objectHash) {
    var objectPath = nodePath.join(directory.gimlet(), "objects", objectHash);
    if (fs.existsSync(objectPath)) {
      return fs.readFileSync(objectPath, "utf8");
    }
  }
};

var hash = function(string) {
  var hashInt = 0;
  for (var i = 0; i < string.length; i++) {
    hashInt = hashInt * 31 + string.charCodeAt(i);
    hashInt = hashInt | 0;
  }

  return Math.abs(hashInt).toString(16);
};

var directory = {
  gimlet: function(dir) {
    if (dir === undefined) { return this.gimlet(process.cwd()); }

    if (fs.existsSync(dir)) {
      var potentialGimletDir = nodePath.join(dir, ".gimlet");
      if (fs.existsSync(potentialGimletDir)) {
        return potentialGimletDir;
      } else if (dir !== "/") {
        return this.gimlet(nodePath.join(dir, ".."));
      }
    }
  },

  repo: function() {
    if (this.gimlet() !== undefined) {
      return nodePath.join(this.gimlet(), "..")
    }
  },

  inRepo: function(cwd) {
    return this.gimlet(cwd) !== undefined;
  },

  assertInRepo: function() {
    if (!this.inRepo()) {
      throw "fatal: Not a gimlet repository (or any of the parent directories): .gimlet";
    }
  },

  pathFromRepoRoot: function(path) {
    return nodePath.relative(this.repo(), nodePath.join(process.cwd(), path));
  }
};

var util = {
  pp: function(obj) {
    console.log(JSON.stringify(obj, null, 2))
  },

  isString: function(thing) {
    return typeof thing === "string";
  }
};

var createFilesFromTree = function(structure, prefix) {
  if (prefix === undefined) { return createFilesFromTree(structure, process.cwd()); }

  Object.keys(structure).forEach(function(name) {
    var path = nodePath.join(prefix, name);
    if (util.isString(structure[name])) {
      fs.writeFileSync(path, structure[name]);
    } else {
      fs.mkdirSync(path, "777");
      createFilesFromTree(structure[name], path);
    }
  });
};
