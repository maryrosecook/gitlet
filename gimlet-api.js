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
          return objectDatabase.writeObject(fileContents);
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

  commit: function(opts) {
    directory.assertInRepo();

    if (Object.keys(index.get()).length === 0) {
      throw "# On branch master\n#\n# Initial commit\n#\n" +
        "nothing to commit (create/copy files and use 'git add' to track)";
    } else {
      var treeHash = this.write_tree();

      if (refs.toHash("HEAD") !== undefined &&
          treeHash === objectDatabase.parseObject(refs.toHash("HEAD")).hash) {
        throw "# On " + head.currentBranchName() + "\n" +
          "nothing to commit, working directory clean";
      } else {
        var commmitHash = objectDatabase.writeCommit(treeHash, opts.m, opts.date);
        refs.set(refs.toFinalRef("HEAD"), commmitHash);
        return "[" + head.currentBranchName() + " " + commmitHash + "] " + opts.m;
      }
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
    } else {
      var hash = refs.toHash(ref2);
      var objectContent = objectDatabase.readObject(hash);
      if (objectContent === undefined) {
        throw "fatal: " + ref2 + ": not a valid SHA1";
      } else if (!(objectDatabase.parseObject(objectContent) instanceof Commit)) {
        throw "error: Trying to write non-commit object " + hash + " to branch " +
          refs.toFinalRef(ref1) + "\n" +
          "fatal: Cannot update the ref " + ref1;
      }
    }
  }
};

var head = {
  currentBranchName: function() {
    var content = fs.readFileSync(nodePath.join(directory.gimlet(), "HEAD"), "utf8");
    if (content.match(/ref:/)) {
      return content.match("ref: refs/heads/(.+)");
    }
  }
};

var refs = {
  isValid: function(ref) {
    return ref === "HEAD" || ref.match("refs/heads/[A-Za-z-]+");
  },

  toFinalRef: function(ref) {
    if (ref === "HEAD") {
      var headContent = fs.readFileSync(nodePath.join(directory.gimlet(), ref))
          .toString()
          .match("ref: (refs/heads/.+)")[1];
      return this.toFinalRef(headContent);
    } else if (ref.match("refs/heads/[A-Za-z-]+")) {
      return ref;
    } else {
      return "refs/heads/" + ref;
    }
  },

  toHash: function(ref) {
    if (!this.isValid(ref)) {
      return ref;
    } else if (this.toFinalRef(ref) !== undefined) {
      var path = nodePath.join(directory.gimlet(), this.toFinalRef(ref));
      if (fs.existsSync(path)) {
        return fs.readFileSync(path, "utf8");
      }
    }
  },

  set: function(ref, hash) {
    if (ref.match("refs/heads/[A-Za-z-]+")) {
      fs.writeFile(nodePath.join(directory.gimlet(), ref), hash);
    }
  }
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

    return this.writeObject(treeObject);
  },

  writeCommit: function(treeHash, message, date) {
    date = date || new Date();
    return this.writeObject("commit " + treeHash + "\n" +
                            "Date:  " + date.toString() + "\n" +
                            "\n" +
                            "    " + message);
  },

  writeObject: function(content) {
    var contentHash = hash(content);
    if (this.readObject(contentHash) === undefined) {
      var filePath = nodePath.join(directory.gimlet(), "objects", contentHash);
      fs.writeFileSync(filePath, content);
    }

    return contentHash;
  },

  readObject: function(objectHash) {
    var objectPath = nodePath.join(directory.gimlet(), "objects", objectHash);
    if (fs.existsSync(objectPath)) {
      return fs.readFileSync(objectPath, "utf8");
    }
  },

  parseObject: function(content) {
    var firstToken = content.split(" ")[0];
    if (firstToken === "commit") {
      return new Commit(content);
    } else if (firstToken === "tree" || firstToken === "blob") {
      return new Tree(content);
    } else {
      return new Blob(content);
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

var Commit = function(content) {
  this.type = "commit";
  this.hash = content.split(" ")[1];
  this.date = new Date(content.split("\n")[1].split(" ")[1]);
  this.message = content.split("\n")[3].split(" ")[1];
};

var Tree = function(content) {
  this.type = "tree";
  this.entries = content.split("\n") // may need to break this up further
};

var Blob = function(content) {
  this.type = "blob";
  this.content = content;
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
