var fs = require('fs');
var nodePath = require('path');

var gimlet = module.exports = {
  init: function() {
    if (files.inRepo()) { return; }

    files.createFilesFromTree({
      ".gimlet": {
        HEAD: "ref: refs/heads/master\n",
        index: "",
        objects: {},
        refs: {
          heads: {},
          remotes: {
            origin: {}
          },
        }
      }
    });
  },

  add: function(path) {
    files.assertInRepo();

    var addedFiles = index.getWorkingCopyFilesFrom(path);
    if (addedFiles.length === 0) {
      throw "fatal: pathspec '" + files.pathFromRepoRoot(path) + "' did not match any files";
    } else {
      for (var i = 0; i < addedFiles.length; i++) {
        this.update_index(addedFiles[i], { add: true });
      }
    }
  },

  update_index: function(path, opts) {
    files.assertInRepo();
    opts = opts || {};

    var pathFromRoot = files.pathFromRepoRoot(path)
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
  },

  hash_object: function(file, opts) {
    files.assertInRepo();
    opts = opts || {};

    if (!fs.existsSync(file)) {
      throw "fatal: Cannot open '" + file + "': No such file or directory"
    } else {
      var fileContents = fs.readFileSync(file, "utf8");
      if (opts.w) {
        return objects.writeObject(fileContents);
      }

      return util.hash(fileContents);
    }
  },

  write_tree: function() {
    files.assertInRepo();
    return objects.writeTree(index.toTree());
  },

  commit: function(opts) {
    files.assertInRepo();

    if (Object.keys(index.get()).length === 0) {
      throw "# On branch master\n#\n# Initial commit\n#\n" +
        "nothing to commit (create/copy files and use 'git add' to track)";
    } else {
      var treeHash = this.write_tree();

      if (refs.toHash("HEAD") !== undefined &&
          treeHash === objects.parseObject(refs.toHash("HEAD")).hash) {
        throw "# On " + head.currentBranchName() + "\n" +
          "nothing to commit, working directory clean";
      } else {
        var isFirstCommit = refs.toHash("HEAD") === undefined;
        var parentHashes = isFirstCommit ? [] : [refs.toHash("HEAD")];
        var commmitHash = objects.writeCommit(treeHash,
                                                     opts.m,
                                                     parentHashes,
                                                     opts.date);
        this.update_ref("HEAD", commmitHash);
        return "[" + head.currentBranchName() + " " + commmitHash + "] " + opts.m;
      }
    }
  },

  branch: function(name) {
    files.assertInRepo();

    if (name === undefined) {
      return refs.localHeads().map(function(branchName) {
        var marker = branchName === head.currentBranchName() ? "* " : "  ";
        return marker + branchName;
      }).join("\n") + "\n";
    } else if (refs.toHash("HEAD") === undefined) {
      throw "fatal: Not a valid object name: '" + head.currentBranchName() + "'.";
    } else {
      refs.set(refs.nameToBranchRef(name), refs.toHash("HEAD"));
    }
  },

  symbolic_ref: function(symbolicRef, refToUpdateTo) {
    files.assertInRepo();

    if (symbolicRef !== "HEAD") {
      throw "fatal: ref " + symbolicRef + " is not a symbolic ref";
    } else if (refToUpdateTo === undefined) {
      return head.get();
    } else if (refs.isLocalHeadRef(refToUpdateTo)) {
      head.set(refToUpdateTo);
    } else {
      throw "fatal: Refusing to point " + symbolicRef + " outside of refs/heads/";
    }
  },

  update_ref: function(refToUpdate, refToUpdateTo) {
    files.assertInRepo();

    if (!refs.isRef(refToUpdate)) {
      throw "fatal: Cannot lock the ref " + refToUpdate + ".";
    } else {
      var hash;
      if (refs.isRef(refToUpdateTo)) {
        hash = refs.toHash(refToUpdateTo);
      } else if (refs.exists(refs.nameToBranchRef(refToUpdateTo))) {
        hash = refs.toHash(refs.nameToBranchRef(refToUpdateTo));
      } else {
        hash = refToUpdateTo;
      }

      if (!objects.exists(hash)) {
        throw "fatal: " + refToUpdateTo + ": not a valid SHA1";
      } else if (!(objects.parseObject(objects.readObject(hash)) instanceof Commit)) {
        throw "error: Trying to write non-commit object " + hash + " to branch " +
          refs.toTerminalRef(refToUpdate) + "\n" +
          "fatal: Cannot update the ref " + refToUpdate;
      } else {
        refs.set(refs.toTerminalRef(refToUpdate), hash);
      }
    }
  },

  checkout: function(ref) {
    files.assertInRepo();

    var finalRef = refs.isRef(ref) ? ref : refs.toFinalRef(ref);
    var hash = refs.toHash(finalRef);

    if (!objects.exists(hash)) {
      throw "error: pathspec " + ref + " did not match any file(s) known to git."
    }
  }
};

var head = {
  currentBranchName: function() {
    if (this.get().match("refs")) {
      return this.get().match("refs/heads/(.+)")[1];
    }
  },

  get: function() {
    var content = fs.readFileSync(nodePath.join(files.gimletDir(), "HEAD"), "utf8");
    var refMatch = content.match("ref: (refs/heads/.+)");
    return refMatch ? refMatch[1] : content;
  },

  set: function(ref) {
    if (refs.isLocalHeadRef(ref)) {
      fs.writeFileSync(nodePath.join(files.gimletDir(), "HEAD"), "ref: " + ref + "\n");
    }
  }
};

var refs = {
  isLocalHeadRef: function(ref) {
    return ref.match("refs/heads/[A-Za-z-]+");
  },

  isRef: function(ref) {
    return ref === "HEAD" || this.isLocalHeadRef(ref);
  },

  toTerminalRef: function(ref) {
    if (ref === "HEAD") {
      return head.get();
    } else if (this.isLocalHeadRef(ref)) {
      return ref;
    }
  },

  toHash: function(ref) {
    if (this.isRef(ref) && this.toTerminalRef(ref) !== undefined) {
      var path = nodePath.join(files.gimletDir(), this.toTerminalRef(ref));
      if (fs.existsSync(path)) {
        return fs.readFileSync(path, "utf8");
      }
    }
  },

  nameToBranchRef: function(name) {
    return "refs/heads/" + name;
  },

  set: function(ref, content) {
    if (this.isLocalHeadRef(ref)) {
      fs.writeFileSync(nodePath.join(files.gimletDir(), ref), content);
    }
  },

  localHeads: function() {
    return fs.readdirSync(nodePath.join(files.gimletDir(), "refs/heads/"));
  },

  exists: function(ref) {
    return ref !== undefined &&
      this.isLocalHeadRef(ref) &&
      fs.existsSync(nodePath.join(files.gimletDir(), ref));
  }
};

var index = {
  hasFile: function(path) {
    return index.get()[path] !== undefined;
  },

  addFile: function(path) {
    var index = this.get();
    index[path] = util.hash(fs.readFileSync(nodePath.join(files.repoDir(), path), "utf8"));
    gimlet.hash_object(path, { w: true });
    this.set(index);
  },

  get: function() {
    return fs.readFileSync(nodePath.join(files.gimletDir(), "index"), "utf8")
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
    fs.writeFileSync(nodePath.join(files.gimletDir(), "index"), indexStr);
  },

  getWorkingCopyFilesFrom: function(path) {
    if (!fs.existsSync(path)) {
      return [];
    } else if (fs.statSync(path).isFile()) {
      return [path];
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

var objects = {
  writeTree: function(tree) {
    var treeObject = Object.keys(tree).map(function(key) {
      if (util.isString(tree[key])) {
        return "blob " + util.hash(tree[key]) + " " + key;
      } else {
        return "tree " + objects.writeTree(tree[key]) + " " + key;
      }
    }).join("\n") + "\n";

    return this.writeObject(treeObject);
  },

  writeCommit: function(treeHash, message, parentHashes, date) {
    date = date || new Date();
    var parentLines = parentHashes.map(function(h) {
      return "parent " + h + "\n";
    }).join("");

    return this.writeObject("commit " + treeHash + "\n" +
                            parentLines +
                            "Date:  " + date.toString() + "\n" +
                            "\n" +
                            "    " + message);
  },

  writeObject: function(content) {
    var contentHash = util.hash(content);
    if (this.readObject(contentHash) === undefined) {
      var filePath = nodePath.join(files.gimletDir(), "objects", contentHash);
      fs.writeFileSync(filePath, content);
    }

    return contentHash;
  },

  exists: function(objectHash) {
    return objectHash !== undefined &&
      fs.existsSync(nodePath.join(files.gimletDir(), "objects", objectHash));
  },

  readObject: function(objectHash) {
    var objectPath = nodePath.join(files.gimletDir(), "objects", objectHash);
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

var files = {
  gimletDir: function(dir) {
    if (dir === undefined) { return this.gimletDir(process.cwd()); }

    if (fs.existsSync(dir)) {
      var potentialGimletDir = nodePath.join(dir, ".gimlet");
      if (fs.existsSync(potentialGimletDir)) {
        return potentialGimletDir;
      } else if (dir !== "/") {
        return this.gimletDir(nodePath.join(dir, ".."));
      }
    }
  },

  repoDir: function() {
    if (this.gimletDir() !== undefined) {
      return nodePath.join(this.gimletDir(), "..")
    }
  },

  inRepo: function(cwd) {
    return this.gimletDir(cwd) !== undefined;
  },

  assertInRepo: function() {
    if (!this.inRepo()) {
      throw "fatal: Not a gimlet repository (or any of the parent directories): .gimlet";
    }
  },

  pathFromRepoRoot: function(path) {
    return nodePath.relative(this.repoDir(), nodePath.join(process.cwd(), path));
  },

  createFilesFromTree: function(structure, prefix) {
    if (prefix === undefined) {
      return files.createFilesFromTree(structure, process.cwd());
    }

    Object.keys(structure).forEach(function(name) {
      var path = nodePath.join(prefix, name);
      if (util.isString(structure[name])) {
        fs.writeFileSync(path, structure[name]);
      } else {
        fs.mkdirSync(path, "777");
        files.createFilesFromTree(structure[name], path);
      }
    });
  }
};

function Commit(content) {
  this.type = "commit";
  this.tree = content.split(" ")[1];
  this.date = new Date(content.split("\n")[1].split(" ")[1]);
  this.message = content.split("\n")[3].split(" ")[1];
};

function Tree(content) {
  this.type = "tree";
  this.entries = content.split("\n") // may need to break this up further
};

function Blob(content) {
  this.type = "blob";
  this.content = content;
};

var util = {
  isString: function(thing) {
    return typeof thing === "string";
  },

  hash: function(string) {
    var hashInt = 0;
    for (var i = 0; i < string.length; i++) {
      hashInt = hashInt * 31 + string.charCodeAt(i);
      hashInt = hashInt | 0;
    }

    return Math.abs(hashInt).toString(16);
  }
};
