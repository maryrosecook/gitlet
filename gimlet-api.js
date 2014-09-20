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

    var addedFiles = files.lsRecursive(path);
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
    } else if (!index.readHasFile(path) && opts.add === undefined) {
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
        return objects.write(fileContents);
      }

      return util.hash(fileContents);
    }
  },

  write_tree: function() {
    files.assertInRepo();
    return objects.writeTree(index.objToTree(index.strToObj(index.read())));
  },

  commit: function(opts) {
    files.assertInRepo();

    if (Object.keys(index.strToObj(index.read())).length === 0) {
      throw "# On branch master\n#\n# Initial commit\n#\n" +
        "nothing to commit (create/copy files and use 'git add' to track)";
    } else {
      var headHash = refs.readExistentHash("HEAD");
      var treeHash = this.write_tree();

      if (headHash !== undefined &&
          treeHash === objects.readTreeHash(objects.read(headHash))) {
        throw "# On " + head.currentBranchName() + "\n" +
          "nothing to commit, working directory clean";
      } else {
        var isFirstCommit = refs.readExistentHash("HEAD") === undefined;
        var parentHashes = isFirstCommit ? [] : [refs.readExistentHash("HEAD")];
        var commmitHash = objects.write(objects.commitContent(treeHash, opts.m, parentHashes));
        this.update_ref("HEAD", commmitHash);
        return "[" + head.currentBranchName() + " " + commmitHash + "] " + opts.m;
      }
    }
  },

  branch: function(name) {
    files.assertInRepo();

    if (name === undefined) {
      return refs.readLocalHeads().map(function(branchName) {
        var marker = branchName === head.currentBranchName() ? "* " : "  ";
        return marker + branchName;
      }).join("\n") + "\n";
    } else if (refs.readExistentHash("HEAD") === undefined) {
      throw "fatal: Not a valid object name: '" + head.currentBranchName() + "'.";
    } else {
      refs.write(refs.nameToBranchRef(name), refs.readExistentHash("HEAD"));
    }
  },

  update_ref: function(refToUpdate, refToUpdateTo) {
    files.assertInRepo();

    if (!refs.isRef(refToUpdate)) {
      throw "fatal: Cannot lock the ref " + refToUpdate + ".";
    } else {
      var hash = refs.readExistentHash(refToUpdateTo);
      if (!objects.exists(hash)) {
        throw "fatal: " + refToUpdateTo + ": not a valid SHA1";
      } else if (!(objects.type(objects.read(hash)) === "commit")) {
        throw "error: Trying to write non-commit object " + hash + " to branch " +
          refs.toLocalHead(refToUpdate) + "\n" +
          "fatal: Cannot update the ref " + refToUpdate;
      } else {
        refs.write(refs.toLocalHead(refToUpdate), hash);
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
  },

  diff: function(ref1, ref2, opts) {
    files.assertInRepo();

    if (opts["name-only"] !== true) {
      throw "unsupported"; // for now
    }
  }
};

var head = {
  currentBranchName: function() {
    if (this.read().match("refs")) {
      return this.read().match("refs/heads/(.+)")[1];
    }
  },

  read: function() {
    var content = files.read(nodePath.join(files.gimletDir(), "HEAD"));
    var refMatch = content.match("ref: (refs/heads/.+)");
    return refMatch ? refMatch[1] : content;
  },

  write: function(ref) {
    if (refs.isLocalHeadRef(ref)) {
      files.write(nodePath.join(files.gimletDir(), "HEAD"), "ref: " + ref + "\n");
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
      return head.read();
    } else if (this.isLocalHeadRef(ref)) {
      return ref;
    } else {
      return this.nameToBranchRef(ref);
    }
  },

  readExistentHash: function(ref) {
    if (objects.exists(ref)) {
      return ref;
    } else if (this.readExists(this.toLocalHead(ref))) {
      return files.read(nodePath.join(files.gimletDir(), this.toLocalHead(ref)));
    } else if (this.readExists(this.nameToBranchRef(ref))) {
      return files.read(nodePath.join(files.gimletDir(), this.nameToBranchRef(ref)));
    }
  },

  nameToBranchRef: function(name) {
    return "refs/heads/" + name;
  },

  write: function(ref, content) {
    if (this.isLocalHeadRef(ref)) {
      files.write(nodePath.join(files.gimletDir(), ref), content);
    }
  },

  readLocalHeads: function() {
    return fs.readdirSync(nodePath.join(files.gimletDir(), "refs/heads/"));
  },

  readExists: function(ref) {
    return ref !== undefined &&
      this.isLocalHeadRef(ref) &&
      fs.existsSync(nodePath.join(files.gimletDir(), ref));
  }
};

var index = {
  readHasFile: function(path) {
    return this.strToObj(this.read())[path] !== undefined;
  },

  read: function() {
    return files.read(nodePath.join(files.gimletDir(), "index"));
  },

  addFile: function(path) {
    var index = this.strToObj(this.read());
    index[path] = util.hash(files.read(nodePath.join(files.repoDir(), path)));
    gimletApi.hash_object(path, { w: true });
    this.write(index);
  },

  strToObj: function(content) { // CHUCK THIS WHEN REFACTOR DONE
    return util.lines(content)
      .reduce(function(index, blobStr) {
        var blobData = blobStr.split(/ /);
        index[blobData[0]] = blobData[1];
        return index;
      }, {});
  },

  write: function(index) {
    var indexStr = Object.keys(index)
        .map(function(path) { return path + " " + index[path]; })
        .join("\n")
        .concat("\n"); // trailing new line
    files.write(nodePath.join(files.gimletDir(), "index"), indexStr);
  },

  objToTree: function(obj) {
    var tree = {};
    Object.keys(obj).forEach(function(wholePath) {
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

    return this.write(treeObject);
  },

  commitContent: function(treeHash, message, parentHashes) {
    return "commit " + treeHash + "\n" +
      parentHashes.map(function(h) { return "parent " + h + "\n"; }).join("") +
      "Date:  " + new Date().toString() + "\n" +
      "\n" +
      "    " + message;
  },

  write: function(content) {
    var contentHash = util.hash(content);
    if (this.read(contentHash) === undefined) {
      var filePath = nodePath.join(files.gimletDir(), "objects", contentHash);
      files.write(filePath, content);
    }

    return contentHash;
  },

  exists: function(objectHash) {
    return objectHash !== undefined &&
      fs.existsSync(nodePath.join(files.gimletDir(), "objects", objectHash));
  },

  read: function(objectHash) {
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

  readTreeHash: function(content) {
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
        files.write(path, structure[name]);
      } else {
        fs.mkdirSync(path, "777");
        files.createFilesFromTree(structure[name], path);
      }
    });
  },

  read: function(path) {
    return fs.readFileSync(path, "utf8");
  },

  write: function(path, content) {
    fs.writeFileSync(path, content);
  },

  lsRecursive: function(path) {
    if (!fs.existsSync(path)) {
      return [];
    } else if (fs.statSync(path).isFile()) {
      return [path];
    } else if (fs.statSync(path).isDirectory()) {
      var self = this;
      return fs.readdirSync(path).reduce(function(files, dirChild) {
        return files.concat(self.lsRecursive(nodePath.join(path, dirChild)));
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
  },

  lines: function(str) {
    return str.split("\n").slice(0, -1); // last is empty
  }
};
