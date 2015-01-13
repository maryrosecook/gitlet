var fs = require("fs");
var nodePath = require("path");

var gitlet = module.exports = {
  init: function(opts) {
    if (files.inRepo()) { return; }
    opts = opts || {};

    var gitletStructure = {
      HEAD: "ref: refs/heads/master\n",
      config: config.objToStr({ core: { "": { bare: opts.bare === true }}}),
      objects: {},
      refs: {
        heads: {},
      }
    };

    files.writeFilesFromTree(opts.bare ? gitletStructure : { ".gitlet": gitletStructure },
                             process.cwd());
  },

  add: function(path, _) {
    files.assertInRepo();
    config.assertNotBare();

    var addedFiles = files.lsRecursive(path);
    if (addedFiles.length === 0) {
      throw new Error(files.pathFromRepoRoot(path) + " did not match any files");
    } else {
      addedFiles.forEach(function(p) { gitlet.update_index(p, { add: true }); });
    }
  },

  rm: function(path, opts) {
    files.assertInRepo();
    config.assertNotBare();
    opts = opts || {};

    var filesToRm = index.matchingFiles(path);
    if (opts.f) {
      throw new Error("unsupported");
    } else if (filesToRm.length === 0) {
      throw new Error(files.pathFromRepoRoot(path) + " did not match any files");
    } else if (fs.existsSync(path) && fs.statSync(path).isDirectory() && !opts.r) {
      throw new Error("not removing " + path + " recursively without -r");
    } else {
      var changesToRm = util.intersection(diff.addedOrModifiedFiles(), filesToRm);
      if (changesToRm.length > 0) {
        throw new Error("these files have changes:\n" + changesToRm.join("\n") + "\n");
      } else {
        filesToRm.filter(fs.existsSync).forEach(fs.unlinkSync);
        filesToRm.forEach(function(p) { gitlet.update_index(p, { remove: true }); });
      }
    }
  },

  commit: function(opts) {
    files.assertInRepo();
    config.assertNotBare();

    var headHash = refs.hash("HEAD");
    var treeHash = this.write_tree();
    var headDesc = refs.isHeadDetached() ? "detached HEAD" : refs.headBranchName();

    if (headHash !== undefined && treeHash === objects.treeHash(objects.read(headHash))) {
      throw new Error("# On " + headDesc + "\nnothing to commit, working directory clean");
    } else {
      var conflictedPaths = index.conflictedPaths();
      if (merge.isMergeInProgress() && conflictedPaths.length > 0) {
        throw new Error(conflictedPaths.map(function(p) { return "U " + p; }).join("\n") +
                        "\ncannot commit because you have unmerged files\n");
      } else {
        var m = merge.isMergeInProgress() ? files.read(files.gitletPath("MERGE_MSG")) : opts.m;
        var commitHash = objects.writeCommit(treeHash, m, refs.commitParentHashes());
        this.update_ref("HEAD", commitHash);
        if (merge.isMergeInProgress()) {
          fs.unlinkSync(files.gitletPath("MERGE_MSG"));
          refs.rm("MERGE_HEAD");
          return "Merge made by the three-way strategy";
        } else {
          return "[" + headDesc + " " + commitHash + "] " + m;
        }
      }
    }
  },

  branch: function(name, opts) {
    files.assertInRepo();
    opts = opts || {};

    if (name === undefined) {
      return Object.keys(refs.localHeads()).map(function(branch) {
        return (branch === refs.headBranchName() ? "* " : "  ") + branch;
      }).join("\n") + "\n";
    } else if (refs.hash("HEAD") === undefined) {
      throw new Error(refs.headBranchName() + " not a valid object name");
    } else if (refs.exists(refs.toLocalRef(name))) {
      throw new Error("A branch named " + name + " already exists");
    } else {
      this.update_ref(refs.toLocalRef(name), refs.hash("HEAD"));
    }
  },

  checkout: function(ref, _) {
    files.assertInRepo();
    config.assertNotBare();

    var toHash = refs.hash(ref);
    if (!objects.exists(toHash)) {
      throw new Error(ref + " did not match any file(s) known to Gitlet");
    } else if (objects.type(objects.read(toHash)) !== "commit") {
      throw new Error("reference is not a tree: " + ref);
    } else if (ref === refs.headBranchName() ||
               ref === files.read(files.gitletPath("HEAD"))) {
      return "Already on " + ref;
    } else {
      var paths = diff.changedFilesCommitWouldOverwrite(toHash);
      if (paths.length > 0) {
        throw new Error("local changes would be lost\n" + paths.join("\n") + "\n")
      } else {
        process.chdir(files.workingCopyPath());

        var isDetachingHead = objects.exists(ref);
        workingCopy.write(diff.diff(refs.hash("HEAD"), toHash));
        refs.write("HEAD", isDetachingHead ? toHash : "ref: " + refs.toLocalRef(ref));
        index.write(index.tocToIndex(objects.commitToc(toHash)));
        return isDetachingHead ?
          "Note: checking out " + toHash + "\nYou are in detached HEAD state." :
          "Switched to branch " + ref;
      }
    }
  },

  diff: function(ref1, ref2, opts) {
    files.assertInRepo();
    config.assertNotBare();

    if (ref1 !== undefined && refs.hash(ref1) === undefined) {
      throw new Error("ambiguous argument " + ref1 + ": unknown revision");
    } else if (ref2 !== undefined && refs.hash(ref2) === undefined) {
      throw new Error("ambiguous argument " + ref2 + ": unknown revision");
    } else {
      if (opts["name-status"] !== true) {
        throw new Error("unsupported");
      } else {
        var nameToStatus = diff.nameStatus(diff.diff(refs.hash(ref1), refs.hash(ref2)));
        return Object.keys(nameToStatus)
          .map(function(path) { return nameToStatus[path] + " " + path; })
          .join("\n") + "\n";
      }
    }
  },

  remote: function(command, name, path, _) {
    files.assertInRepo();

    if (command !== "add") {
      throw new Error("unsupported");
    } else if (name in config.read()["remote"]) {
      throw new Error("remote " + name + " already exists");
    } else if (command === "add") {
      config.write(util.assocIn(config.read(), ["remote", name, "url", path]));
      return "\n";
    }
  },

  fetch: function(remote, branch, _) {
    files.assertInRepo();

    if (remote === undefined || branch === undefined) {
      throw new Error("unsupported");
    } else if (!(remote in config.read().remote)) {
      throw new Error(remote + " does not appear to be a git repository");
    } else {
      var remoteUrl = config.read().remote[remote].url;
      var remoteRef =  refs.toRemoteRef(remote, branch);
      var oldHash = refs.hash(remoteRef);
      var newHash = util.remote(remoteUrl)(refs.hash, branch);
      if (newHash === undefined) {
        throw new Error("couldn't find remote ref " + branch);
      } else {
        var remoteObjects = util.remote(remoteUrl)(objects.allObjects);
        remoteObjects.forEach(objects.write);
        gitlet.update_ref(remoteRef, newHash);
        refs.write("FETCH_HEAD", newHash + " branch " + branch + " of " + remoteUrl);

        return ["From " + remoteUrl,
                "Count " + remoteObjects.length,
                branch + " -> " + remote + "/" + branch +
                (merge.isForce(oldHash, newHash) ? " (forced)" : "")].join("\n") + "\n";
      }
    }
  },

  merge: function(ref, _) {
    files.assertInRepo();
    config.assertNotBare();

    var receiverHash = refs.hash("HEAD");
    var giverHash = refs.hash(ref);
    if (refs.isHeadDetached()) {
      throw new Error("unsupported");
    } else if (giverHash === undefined || objects.type(objects.read(giverHash)) !== "commit") {
      throw new Error(ref + ": expected commit type");
    } else if (objects.isUpToDate(receiverHash, giverHash)) {
      return "Already up-to-date";
    } else {
      var paths = diff.changedFilesCommitWouldOverwrite(giverHash);
      if (paths.length > 0) {
        throw new Error("local changes would be lost\n" + paths.join("\n") + "\n");
      } else if (merge.canFastForward(receiverHash, giverHash)) {
        merge.writeFastForwardMerge(receiverHash, giverHash);
        return "Fast-forward";
      } else {
        merge.writeNonFastForwardMerge(receiverHash, giverHash, ref);
        if (merge.hasConflicts(receiverHash, giverHash)) {
          return "Automatic merge failed. Fix conflicts and commit the result.";
        } else {
          return this.commit();
        }
      }
    }
  },

  pull: function(remote, branch, _) {
    files.assertInRepo();
    config.assertNotBare();
    this.fetch(remote, branch);
    return this.merge("FETCH_HEAD");
  },

  push: function(remote, branch, opts) {
    files.assertInRepo();
    opts = opts || {};

    if (remote === undefined || branch === undefined) {
      throw new Error("unsupported");
    } else if (refs.isHeadDetached()) {
      throw new Error("you are not currently on a branch");
    } else if (!(remote in config.read().remote)) {
      throw new Error(remote + " does not appear to be a git repository");
    } else {
      var remotePath = config.read().remote[remote].url;
      var remoteCall = util.remote(remotePath);
      if (remoteCall(refs.isCheckedOut, branch)) {
        throw new Error("refusing to update checked out branch " + branch);
      } else {
        var receiverHash = remoteCall(refs.hash, branch);
        var giverHash = refs.hash(branch);
        if (objects.isUpToDate(receiverHash, giverHash)) {
          return "Already up-to-date";
        } else if (!opts.f && !merge.canFastForward(receiverHash, giverHash)) {
          throw new Error("failed to push some refs to " + remotePath);
        } else {
          objects.allObjects().forEach(function(o) { remoteCall(objects.write, o); });
          gitlet.update_ref(refs.toRemoteRef(remote, branch), giverHash);
          remoteCall(gitlet.update_ref, refs.toLocalRef(branch), giverHash);
          return ["To " + remotePath,
                  "Count " + objects.allObjects().length,
                  branch + " -> " + branch].join("\n") + "\n";
        }
      }
    }
  },

  status: function(_) {
    files.assertInRepo();
    config.assertNotBare();
    return status.toString();
  },

  clone: function(remotePath, targetPath, opts) {
    opts = opts || {};

    if (remotePath === undefined || targetPath === undefined) {
      throw new Error("you must specify remote path and target path");
    } else if (!fs.existsSync(remotePath) || !util.remote(remotePath)(files.inRepo)) {
      throw new Error("repository " + remotePath + " does not exist");
    } else if (fs.existsSync(targetPath) && fs.readdirSync(targetPath).length > 0) {
      throw new Error(targetPath + " already exists and is not empty");
    } else {
      remotePath = nodePath.resolve(process.cwd(), remotePath);
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath)
      }

      util.remote(targetPath)(function() {
        gitlet.init(opts);
        gitlet.remote("add", "origin", nodePath.relative(process.cwd(), remotePath));
        var remoteHeadHash = util.remote(remotePath)(refs.hash, "HEAD");
        if (remoteHeadHash !== undefined) {
          gitlet.fetch("origin", "master");
          merge.writeFastForwardMerge(undefined, remoteHeadHash);
        }
      });

      return "Cloning into " + targetPath;
    }
  },

  update_index: function(path, opts) {
    files.assertInRepo();
    config.assertNotBare();
    opts = opts || {};

    var pathFromRoot = files.pathFromRepoRoot(path);
    var isOnDisk = fs.existsSync(path);
    var isInIndex = index.hasFile(path, 0);

    if (isOnDisk && fs.statSync(path).isDirectory()) {
      throw new Error(pathFromRoot + " is a directory - add files inside\n");
    } else if (opts.remove && !isOnDisk && isInIndex) {
      if (index.isFileInConflict(path)) {
        throw new Error("unsupported");
      } else {
        index.writeRm(path);
        return "\n";
      }
    } else if (opts.remove && !isOnDisk && !isInIndex) {
      return "\n";
    } else if (!opts.add && isOnDisk && !isInIndex) {
      throw new Error("cannot add " + pathFromRoot + " to index - use --add option\n");
    } else if (isOnDisk && (opts.add || isInIndex)) {
      index.writeAdd(path);
      return "\n";
    } else if (!opts.remove && !isOnDisk) {
      throw new Error(pathFromRoot + " does not exist and --remove not passed\n");
    }
  },

  write_tree: function(_) {
    files.assertInRepo();
    return objects.writeTree(files.nestFlatTree(index.toc()));
  },

  update_ref: function(refToUpdate, refToUpdateTo, _) {
    files.assertInRepo();

    var hash = refs.hash(refToUpdateTo);
    if (!objects.exists(hash)) {
      throw new Error(refToUpdateTo + " not a valid SHA1");
    } else if (!refs.isRef(refToUpdate)) {
      throw new Error("cannot lock the ref " + refToUpdate);
    } else if (objects.type(objects.read(hash)) !== "commit") {
      var branch = refs.terminalRef(refToUpdate);
      throw new Error(branch + " cannot refer to non-commit object " + hash + "\n")
    } else {
      refs.write(refs.terminalRef(refToUpdate), hash);
    }
  }
};

var refs = {
  isRef: function(ref) {
    return ref !== undefined &&
      (ref.match("refs/heads/[A-Za-z-]+") ||
       ref.match("refs/remotes/[A-Za-z-]+/[A-Za-z-]+") ||
       ["HEAD", "FETCH_HEAD", "MERGE_HEAD"].indexOf(ref) !== -1);
  },

  terminalRef: function(ref) {
    if (ref === "HEAD" && !this.isHeadDetached()) {
      return files.read(files.gitletPath("HEAD")).match("ref: (refs/heads/.+)")[1];
    } else if (refs.isRef(ref)) {
      return ref;
    } else {
      return refs.toLocalRef(ref);
    }
  },

  hash: function(refOrHash) {
    if (objects.exists(refOrHash)) {
      return refOrHash;
    } else {
      var terminalRef = refs.terminalRef(refOrHash);
      if (terminalRef === "FETCH_HEAD") {
        return refs.fetchHeadBranchToMerge(refs.headBranchName());
      } else if (refs.exists(terminalRef)) {
        return files.read(files.gitletPath(terminalRef));
      }
    }
  },

  isHeadDetached: function() {
    return files.read(files.gitletPath("HEAD")).match("refs") === null;
  },

  isCheckedOut: function(branch) {
    return !config.isBare() && refs.headBranchName() === branch;
  },

  toLocalRef: function(name) {
    return "refs/heads/" + name;
  },

  toRemoteRef: function(remote, name) {
    return "refs/remotes/" + remote + "/" + name;
  },

  write: function(ref, content) {
    if(refs.isRef(ref)) {
      var tree = util.assocIn({}, ref.split(nodePath.sep).concat(content));
      files.writeFilesFromTree(tree, files.gitletPath());
    }
  },

  rm: function(ref) {
    if(refs.isRef(ref)) {
      fs.unlinkSync(files.gitletPath(ref));
    }
  },

  fetchHeadBranchToMerge: function(branchName) {
    return util.lines(files.read(files.gitletPath("FETCH_HEAD")))
      .filter(function(l) { return l.match("^.+ branch " + branchName + " of"); })
      .map(function(l) { return l.match("^([^ ]+) ")[1]; })[0];
  },

  localHeads: function() {
    return fs.readdirSync(nodePath.join(files.gitletPath(), "refs", "heads"))
      .reduce(function(o, n) { return util.assocIn(o, [n, refs.hash(n)]); }, {});
  },

  exists: function(ref) {
    return refs.isRef(ref) && fs.existsSync(files.gitletPath(ref));
  },

  headBranchName: function() {
    if (!refs.isHeadDetached()) {
      return files.read(files.gitletPath("HEAD")).match("refs/heads/(.+)")[1];
    }
  },

  commitParentHashes: function() {
    var headHash = refs.hash("HEAD");
    if (merge.isMergeInProgress()) {
      return [headHash, refs.hash("MERGE_HEAD")];
    } else if (headHash === undefined) {
      return [];
    } else {
      return [headHash];
    }
  }
};

var objects = {
  writeTree: function(tree) {
    var treeObject = Object.keys(tree).map(function(key) {
      if (util.isString(tree[key])) {
        return "blob " + tree[key] + " " + key;
      } else {
        return "tree " + objects.writeTree(tree[key]) + " " + key;
      }
    }).join("\n") + "\n";

    return objects.write(treeObject);
  },

  fileTree: function(treeHash, tree) {
    if (tree === undefined) { return objects.fileTree(treeHash, {}); }

    util.lines(objects.read(treeHash)).forEach(function(line) {
      var lineTokens = line.split(/ /);
      tree[lineTokens[2]] = lineTokens[0] === "tree" ?
        objects.fileTree(lineTokens[1], {}) :
        lineTokens[1];
    });

    return tree;
  },

  writeCommit: function(treeHash, message, parentHashes) {
    return this.write("commit " + treeHash + "\n" +
                      parentHashes.map(function(h) { return "parent " + h + "\n"; }).join("") +
                      "Date:  " + new Date().toString() + "\n" +
                      "\n" +
                      "    " + message + "\n");
  },

  write: function(str) {
    files.write(nodePath.join(files.gitletPath(), "objects", util.hash(str)), str);
    return util.hash(str);
  },

  isUpToDate: function(receiverHash, giverHash) {
    return receiverHash !== undefined &&
      (receiverHash === giverHash || objects.isAncestor(receiverHash, giverHash));
  },

  exists: function(objectHash) {
    return objectHash !== undefined &&
      fs.existsSync(nodePath.join(files.gitletPath(), "objects", objectHash));
  },

  read: function(objectHash) {
    if (objectHash !== undefined) {
      var objectPath = nodePath.join(files.gitletPath(), "objects", objectHash);
      if (fs.existsSync(objectPath)) {
        return files.read(objectPath);
      }
    }
  },

  allObjects: function() {
    return fs.readdirSync(files.gitletPath("objects")).map(objects.read);
  },

  type: function(str) {
    return { commit: "commit", tree: "tree", blob: "tree" }[str.split(" ")[0]] || "blob";
  },

  isAncestor: function(descendentHash, ancestorHash) {
    return objects.ancestors(descendentHash).indexOf(ancestorHash) !== -1;
  },

  ancestors: function(commitHash) {
    var parents = objects.parentHashes(objects.read(commitHash));
    return util.flatten(parents.concat(parents.map(objects.ancestors)));
  },

  parentHashes: function(str) {
    if (objects.type(str) === "commit") {
      return str.split("\n")
        .filter(function(line) { return line.match(/^parent/); })
        .map(function(line) { return line.split(" ")[1]; });
    }
  },

  treeHash: function(str) {
    if (objects.type(str) === "commit") {
      return str.split(/\s/)[1];
    }
  },

  commitToc: function(hash) {
    return files.flattenNestedTree(objects.fileTree(objects.treeHash(objects.read(hash))));
  }
};

var index = {
  hasFile: function(path, stage) {
    return index.read()[index.key(path, stage)] !== undefined;
  },

  read: function() {
    var indexFilePath = files.gitletPath("index");
    return util.lines(fs.existsSync(indexFilePath) ? files.read(indexFilePath) : "\n")
      .reduce(function(idx, blobStr) {
        var blobData = blobStr.split(/ /);
        idx[index.key(blobData[0], blobData[1])] = blobData[2];
        return idx;
      }, {});
  },

  key: function(path, stage) {
    return path + "," + stage;
  },

  keyPieces: function(key) {
    var pieces = key.split(/,/);
    return { path: pieces[0], stage: parseInt(pieces[1]) };
  },

  toc: function() {
    var idx = index.read();
    return Object.keys(idx)
      .reduce(function(obj, k) { return util.assocIn(obj, [k.split(",")[0], idx[k]]); }, {});
  },

  isFileInConflict: function(path) {
    return index.hasFile(path, 2);
  },

  conflictedPaths: function() {
    var idx = index.read();
    return Object.keys(idx)
      .filter(function(k) { return index.keyPieces(k).stage === 2; })
      .map(function(k) { return index.keyPieces(k).path; });
  },

  writeAdd: function(path) {
    if (index.isFileInConflict(path)) {
      index.rmEntry(path, 1);
      index.rmEntry(path, 2);
      index.rmEntry(path, 3);
    }

    index.writeEntry(path, 0, files.read(files.workingCopyPath(path)));
  },

  writeRm: function(path) {
    index.rmEntry(path, 0);
  },

  writeEntry: function(path, stage, content) {
    var idx = index.read();
    idx[index.key(path, stage)] = objects.write(content);
    index.write(idx);
  },

  rmEntry: function(path, stage) {
    var idx = index.read();
    delete idx[index.key(path, stage)];
    index.write(idx);
  },

  write: function(index) {
    var indexStr = Object.keys(index)
        .map(function(k) { return k.split(",")[0] + " " + k.split(",")[1] + " " + index[k] })
        .join("\n") + "\n";
    files.write(files.gitletPath("index"), indexStr);
  },

  workingCopyToc: function() {
    return Object.keys(index.read())
      .map(function(k) { return k.split(",")[0]; })
      .filter(function(p) { return fs.existsSync(files.workingCopyPath(p)); })
      .reduce(function(idx, p) {
        idx[p] = util.hash(files.read(files.workingCopyPath(p)))
        return idx;
      }, {});
  },

  tocToIndex: function(toc) {
    return Object.keys(toc)
      .reduce(function(idx, p) { return util.assocIn(idx, [index.key(p, 0), toc[p]]); }, {});
  },

  matchingFiles: function(pathSpec) {
    var prefix = nodePath.relative(files.workingCopyPath(), process.cwd());
    var searchPath = nodePath.join(prefix, pathSpec);
    return Object.keys(index.toc())
      .filter(function(p) { return p.match("^" + searchPath); });
  }
};

var diff = {
  FILE_STATUS: { ADD: "A", MODIFY: "M", DELETE: "D", SAME: "SAME", CONFLICT: "CONFLICT" },

  diff: function(hash1, hash2) {
    var a = hash1 === undefined ? index.toc() : objects.commitToc(hash1);
    var b = hash2 === undefined ? index.workingCopyToc() : objects.commitToc(hash2);
    return diff.tocDiff(a, b);
  },

  nameStatus: function(dif) {
    return Object.keys(dif)
      .filter(function(p) { return dif[p].status !== diff.FILE_STATUS.SAME; })
      .reduce(function(ns, p) { return util.assocIn(ns, [p, dif[p].status]); }, {});
  },

  tocDiff: function(receiver, giver, base) {
    function fileStatus(receiver, base, giver) {
      var receiverPresent = receiver !== undefined;
      var basePresent = base !== undefined;
      var giverPresent = giver !== undefined;
      if (receiverPresent && giverPresent && receiver !== giver) {
        if (receiver !== base && giver !== base) {
          return diff.FILE_STATUS.CONFLICT;
        } else {
          return diff.FILE_STATUS.MODIFY;
        }
      } else if (receiver === giver) {
        return diff.FILE_STATUS.SAME;
      } else if ((!receiverPresent && !basePresent && giverPresent) ||
                 (receiverPresent && !basePresent && !giverPresent)) {
        return diff.FILE_STATUS.ADD;
      } else if ((receiverPresent && basePresent && !giverPresent) ||
                 (!receiverPresent && basePresent && giverPresent)) {
        return diff.FILE_STATUS.DELETE;
      }
    };

    base = base || receiver;
    var paths = Object.keys(receiver).concat(Object.keys(base)).concat(Object.keys(giver));
    return util.unique(paths).reduce(function(idx, p) {
      return util.assocIn(idx, [p, {
        status: fileStatus(receiver[p], base[p], giver[p]),
        receiver: receiver[p],
        base: base[p],
        giver: giver[p]
      }]);
    }, {});
  },

  changedFilesCommitWouldOverwrite: function(hash) {
    var headHash = refs.hash("HEAD");
    var localChanges = diff.nameStatus(diff.diff(headHash));
    var headToBranchChanges = diff.nameStatus(diff.diff(headHash, hash));
    return Object.keys(localChanges)
      .filter(function(path) { return path in headToBranchChanges; });
  },

  addedOrModifiedFiles: function() {
    var headToc = refs.hash("HEAD") ? objects.commitToc(refs.hash("HEAD")) : {};
    var wc = diff.nameStatus(diff.tocDiff(headToc, index.workingCopyToc()));
    return Object.keys(wc).filter(function(p) { return wc[p] !== diff.FILE_STATUS.DELETE; });
  }
};

var merge = {
  commonAncestor: function(aHash, bHash) {
    var sorted = [aHash, bHash].sort();
    aHash = sorted[0];
    bHash = sorted[1];
    var aAncestors = [aHash].concat(objects.ancestors(aHash));
    var bAncestors = [bHash].concat(objects.ancestors(bHash));
    return util.intersection(aAncestors, bAncestors)[0];
  },

  isMergeInProgress: function() {
    return refs.hash("MERGE_HEAD");
  },

  canFastForward: function(receiverHash, giverHash) {
    return receiverHash === undefined || objects.isAncestor(giverHash, receiverHash);
  },

  isForce: function(receiverHash, giverHash) {
    return receiverHash !== undefined && !objects.isAncestor(giverHash, receiverHash);
  },

  hasConflicts: function(receiverHash, giverHash) {
    var mergeDiff = merge.mergeDiff(receiverHash, giverHash);
    return Object.keys(mergeDiff)
      .filter(function(p) {return mergeDiff[p].status===diff.FILE_STATUS.CONFLICT }).length > 0
  },

  mergeDiff: function(receiverHash, giverHash) {
    return diff.tocDiff(objects.commitToc(receiverHash),
                        objects.commitToc(giverHash),
                        objects.commitToc(merge.commonAncestor(receiverHash, giverHash)));
  },

  writeMergeMsg: function(receiverHash, giverHash, ref) {
    var msg = "Merge " + ref + " into " + refs.headBranchName();

    var mergeDiff = merge.mergeDiff(receiverHash, giverHash);
    var conflicts = Object.keys(mergeDiff)
        .filter(function(p) { return mergeDiff[p].status === diff.FILE_STATUS.CONFLICT });
    if (conflicts.length > 0) {
      msg += "\nConflicts:\n" + conflicts.join("\n");
    }

    files.write(files.gitletPath("MERGE_MSG"), msg);
  },

  writeIndex: function(receiverHash, giverHash) {
    var mergeDiff = merge.mergeDiff(receiverHash, giverHash);
    index.write({});
    Object.keys(mergeDiff).forEach(function(p) {
      if (mergeDiff[p].status === diff.FILE_STATUS.CONFLICT) {
        if (mergeDiff[p].base !== undefined) { // (undef if same filepath ADDED w dif content)
          index.writeEntry(p, 1, objects.read(mergeDiff[p].base));
        }

        index.writeEntry(p, 2, objects.read(mergeDiff[p].receiver));
        index.writeEntry(p, 3, objects.read(mergeDiff[p].giver));
      } else if (mergeDiff[p].status === diff.FILE_STATUS.MODIFY) {
        index.writeEntry(p, 0, mergeDiff[p].giver);
      } else if (mergeDiff[p].status === diff.FILE_STATUS.ADD ||
                 mergeDiff[p].status === diff.FILE_STATUS.SAME) {
        var content = objects.read(mergeDiff[p].receiver || mergeDiff[p].giver);
        index.writeEntry(p, 0, content);
      }
    });
  },

  writeFastForwardMerge: function(receiverHash, giverHash) {
    refs.write(refs.toLocalRef(refs.headBranchName()), giverHash);
    index.write(index.tocToIndex(objects.commitToc(giverHash)));
    if (!config.isBare()) {
      var receiverToc = receiverHash === undefined ? {} : objects.commitToc(receiverHash);
      workingCopy.write(diff.tocDiff(receiverToc, objects.commitToc(giverHash)));
    }
  },

  writeNonFastForwardMerge: function(receiverHash, giverHash, giverRef) {
    refs.write("MERGE_HEAD", giverHash);
    merge.writeMergeMsg(receiverHash, giverHash, giverRef);
    merge.writeIndex(receiverHash, giverHash);
    if (!config.isBare()) {
      workingCopy.write(merge.mergeDiff(receiverHash, giverHash));
    }
  }
};

var workingCopy = {
  write: function(dif) {
    function composeConflict(receiverFileHash, giverFileHash) {
      return "<<<<<<\n" + objects.read(receiverFileHash) +
        "\n======\n" + objects.read(giverFileHash) +
        "\n>>>>>>\n";
    };

    Object.keys(dif).forEach(function(p) {
      if (dif[p].status === diff.FILE_STATUS.ADD) {
        files.write(files.workingCopyPath(p), objects.read(dif[p].receiver || dif[p].giver));
      } else if (dif[p].status === diff.FILE_STATUS.CONFLICT) {
        files.write(files.workingCopyPath(p), composeConflict(dif[p].receiver, dif[p].giver));
      } else if (dif[p].status === diff.FILE_STATUS.MODIFY) {
        files.write(files.workingCopyPath(p), objects.read(dif[p].giver));
      } else if (dif[p].status === diff.FILE_STATUS.DELETE) {
        fs.unlinkSync(files.workingCopyPath(p));
      }
    });

    fs.readdirSync(files.workingCopyPath())
      .filter(function(n) { return n !== ".gitlet"; })
      .forEach(files.rmEmptyDirs);
  }
};

var config = {
  isBare: function() {
    return config.read().core[""].bare === "true";
  },

  assertNotBare: function() {
    if (config.isBare()) {
      throw new Error("this operation must be run in a work tree");
    }
  },

  read: function() {
    return config.strToObj(files.read(files.gitletPath("config")));
  },

  write: function(configObj) {
    files.write(files.gitletPath("config"), config.objToStr(configObj));
  },

  strToObj: function(str) {
    return str.split("[")
      .map(function(item) { return item.trim(); })
      .filter(function(item) { return item !== ""; })
      .reduce(function(c, item) {
        var lines = item.split("\n");
        var entry = [];

        // section eg "core"
        entry.push(lines[0].match(/([^ \]]+)( |\])/)[1]);

        // eg "master"
        var subsectionMatch = lines[0].match(/\"(.+)\"/);
        var subsection = subsectionMatch === null ? "" : subsectionMatch[1];
        entry.push(subsection);

        // options and their values
        entry.push(lines.slice(1).reduce(function(s, l) {
          s[l.split("=")[0].trim()] = l.split("=")[1].trim();
          return s;
        }, {}));

        return util.assocIn(c, entry);
      }, { "remote": {} });
  },

  objToStr: function(configObj) {
    return Object.keys(configObj)
      .reduce(function(arr, section) {
        return arr.concat(
          Object.keys(configObj[section])
            .map(function(subsection) { return { section: section, subsection: subsection }})
        );
      }, [])
      .map(function(entry) {
        var subsection = entry.subsection === "" ? "" : " \"" + entry.subsection +"\"";
        var settings = configObj[entry.section][entry.subsection];
        return "[" + entry.section + subsection + "]\n" +
          Object.keys(settings)
          .map(function(k) { return "  " + k + " = " + settings[k]; })
          .join("\n") + "\n";
      })
      .join("");
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
      util.assocIn(obj[arr[0]], arr.slice(1));
    }

    return obj;
  },

  lines: function(str) {
    return str.split("\n").filter(function(l) { return l !== ""; });
  },

  flatten: function(arr) {
    return arr.reduce(function(a, e) {
      return a.concat(e instanceof Array ? util.flatten(e) : e);
    }, []);
  },

  unique: function(array) {
    return array.reduce(function(a, p) { return a.indexOf(p) === -1 ? a.concat(p) : a; }, []);
  },

  intersection: function(a, b) {
    return a.filter(function(e) { return b.indexOf(e) !== -1; });
  },

  remote: function(remoteUrl) {
    return function(fn) {
      var originalDir = process.cwd();
      process.chdir(remoteUrl);
      var result = fn.apply(null, Array.prototype.slice.call(arguments, 1));
      process.chdir(originalDir);
      return result;
    };
  }
};

var files = {
  inRepo: function() {
    return files.gitletPath() !== undefined;
  },

  assertInRepo: function() {
    if (!files.inRepo()) {
      throw new Error("not a Gitlet repository");
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
    function gitletDir(dir) {
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

    var gDir = gitletDir(process.cwd());
    if (gDir !== undefined) {
      return nodePath.join(gDir, path || "");
    }
  },

  workingCopyPath: function(path) {
    return nodePath.join(nodePath.join(this.gitletPath(), ".."), path || "");
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
    return Object.keys(obj).reduce(function(tree, wholePath) {
      return util.assocIn(tree, wholePath.split(nodePath.sep).concat(obj[wholePath]));
    }, {});
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

var status = {
  toString: function() {
    function currentBranch() {
      return ["On branch " + refs.headBranchName()];
    };

    function untracked() {
      var paths = fs.readdirSync(files.workingCopyPath())
          .filter(function(p) { return index.toc()[p] === undefined && p !== ".gitlet"; });
      return paths.length > 0 ? ["Untracked files:"].concat(paths) : [];
    };

    function conflicted() {
      var paths = index.conflictedPaths();
      return paths.length > 0 ? ["Unmerged paths:"].concat(paths) : [];
    };

    function toBeCommitted() {
      var headHash = refs.hash("HEAD");
      var headToc = headHash === undefined ? {} : objects.commitToc(headHash);
      var ns = diff.nameStatus(diff.tocDiff(headToc, index.toc()));
      var entries = Object.keys(ns).map(function(p) { return ns[p] + " " + p; });
      return entries.length > 0 ? ["Changes to be committed:"].concat(entries) : [];
    };

    function notStagedForCommit() {
      var ns = diff.nameStatus(diff.diff());
      var entries = Object.keys(ns).map(function(p) { return ns[p] + " " + p; });
      return entries.length > 0 ? ["Changes not staged for commit:"].concat(entries) : [];
    };

    return [currentBranch(),
            untracked(),
            conflicted(),
            toBeCommitted(),
            notStagedForCommit()]
      .reduce(function(a, section) {
        return section.length > 0 ? a.concat(section, "") : a;
      }, [])
      .join("\n");
  }
};

var parseOptions = function(argv) {
  var name;
  return argv.reduce(function(opts, arg) {
    if (arg.match("^-")) {
      name = arg.replace(/^-+/, "");
      opts[name] = true;
    } else if (name !== undefined) {
      opts[name] = arg;
      name = undefined;
    } else {
      opts._.push(arg);
    }

    return opts;
  }, { _: [] });
};

var runCli = module.exports.runCli = function (argv) {
  var rawArgs = parseOptions(argv);
  var commandFnName = rawArgs._[2].replace(/-/g, "_");
  var fn = gitlet[commandFnName];
  var commandArgs = rawArgs._.slice(3);
  var unspecifiedArgs = Array
      .apply(null, new Array(fn.length - commandArgs.length - 1))
      .map(function() { return undefined; });

  try {
    return fn.apply(gitlet, commandArgs.concat(unspecifiedArgs).concat(rawArgs));
  } catch (e) {
    console.log(e)
  }
};

if (require.main === module) {
  var result = runCli(process.argv);
  if (result !== undefined) {
    console.log(result);
  }
}
