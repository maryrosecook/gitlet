var fs = require('fs');
var nodePath = require('path');

var gimletApi = module.exports = {
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

    var addedFiles = files.recursiveList(path);
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
      var fileContents = files.read(file);
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
      var headHash = refs.toExistentHash("HEAD");
      var treeHash = this.write_tree();

      if (headHash !== undefined &&
          treeHash === objects.getTreeHash(objects.readObject(headHash))) {
        throw "# On " + head.currentBranchName() + "\n" +
          "nothing to commit, working directory clean";
      } else {
        var isFirstCommit = refs.toExistentHash("HEAD") === undefined;
        var parentHashes = isFirstCommit ? [] : [refs.toExistentHash("HEAD")];
        var commmitHash = objects.writeCommit(treeHash, opts.m, parentHashes);
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
    } else if (refs.toExistentHash("HEAD") === undefined) {
      throw "fatal: Not a valid object name: '" + head.currentBranchName() + "'.";
    } else {
      refs.set(refs.nameToBranchRef(name), refs.toExistentHash("HEAD"));
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
      var hash = refs.toExistentHash(refToUpdateTo);
      if (!objects.exists(hash)) {
        throw "fatal: " + refToUpdateTo + ": not a valid SHA1";
      } else if (!(objects.type(objects.readObject(hash)) === "commit")) {
        throw "error: Trying to write non-commit object " + hash + " to branch " +
          refs.toLocalHead(refToUpdate) + "\n" +
          "fatal: Cannot update the ref " + refToUpdate;
      } else {
        refs.set(refs.toLocalHead(refToUpdate), hash);
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
    var content = files.read(nodePath.join(files.gimletDir(), "HEAD"));
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

  toLocalHead: function(ref) {
    if (ref === "HEAD") {
      return head.get();
    } else if (this.isLocalHeadRef(ref)) {
      return ref;
    } else {
      return this.nameToBranchRef(ref);
    }
  },

  toExistentHash: function(ref) {
    if (objects.exists(ref)) {
      return ref;
    } else if (this.exists(this.toLocalHead(ref))) {
      return files.read(nodePath.join(files.gimletDir(), this.toLocalHead(ref)));
    } else if (this.exists(this.nameToBranchRef(ref))) {
      return files.read(nodePath.join(files.gimletDir(), this.nameToBranchRef(ref)));
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
    index[path] = util.hash(files.read(nodePath.join(files.repoDir(), path)));
    gimletApi.hash_object(path, { w: true });
    this.set(index);
  },

  get: function() {
    return files.read(nodePath.join(files.gimletDir(), "index"))
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

  toTree: function() {
    var tree = {};
    Object.keys(this.get()).forEach(function(wholePath) {
      util.assocIn(tree, wholePath.split(nodePath.sep).concat(files.read(wholePath)));
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

  writeCommit: function(treeHash, message, parentHashes) {
    var parentLines = parentHashes.map(function(h) {
      return "parent " + h + "\n";
    }).join("");

    return this.writeObject("commit " + treeHash + "\n" +
                            parentLines +
                            "Date:  " + new Date().toString() + "\n" +
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
      return files.read(objectPath);
    }
  },

  type: function(content) {
    var firstToken = content.split(" ")[0];
    if (firstToken === "commit") {
      return "commit";
    } else if (firstToken === "tree" || firstToken === "blob") {
      return "tree";
    } else {
      return "blob";
    }
  },

  getTreeHash: function(content) {
    if (this.type(content) === "commit") {
      return content.split(/\s/)[1];
    } else if (this.type(content) === "tree") {
      return hash(content);
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
  },

  read: function(path) {
    return fs.readFileSync(path, "utf8");
  },

  recursiveList: function(path) {
    if (!fs.existsSync(path)) {
      return [];
    } else if (fs.statSync(path).isFile()) {
      return [path];
    } else if (fs.statSync(path).isDirectory()) {
      var self = this;
      return fs.readdirSync(path).reduce(function(files, dirChild) {
        return files.concat(self.recursiveList(nodePath.join(path, dirChild)));
      }, []);
    }
  }
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
  },

  assocIn: function(obj, arr) {
    if (arr.length === 2) {
      obj[arr[0]] = arr[1];
    } else if (arr.length > 2) {
      obj[arr[0]] = obj[arr[0]] || {};
      this.assocIn(obj[arr[0]], arr.slice(1));
    }
  }
};
