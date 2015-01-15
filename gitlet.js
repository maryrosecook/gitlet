var fs = require("fs");
var nodePath = require("path");

// Main Git API functions
// ----------------------

var gitlet = module.exports = {

  // **init()** initializes the current directory as a new repo.
  init: function(opts) {

    // Abort if already a repo.
    if (files.inRepo()) { return; }

    opts = opts || {};

    // Create a JS object that mirrors the Git basic directory structure.
    var gitletStructure = {
      HEAD: "ref: refs/heads/master\n",

      // If `--bare` was passed, write to the Git config indicating
      // that the repo is bare.  If `--bare` was not passed, write to
      // the Git config saying the repo is not bare.
      config: config.objToStr({ core: { "": { bare: opts.bare === true }}}),

      objects: {},
      refs: {
        heads: {},
      }
    };

    // Write the standard Git directory structure using the
    // `gitletStructure` JS object.  If the repo is not bare, put the
    // directories inside the `.gitlet` directory.  If the repo is
    // bare, put them in the top level of the repo.
    files.writeFilesFromTree(opts.bare ? gitletStructure : { ".gitlet": gitletStructure },
                             process.cwd());
  },

  // **add()** adds files that match `path` to the index.
  add: function(path, _) {
    files.assertInRepo();
    config.assertNotBare();

    // Get the paths of all the files matching `path`.
    var addedFiles = files.lsRecursive(path);

    // Abort if no files matched `path`.
    if (addedFiles.length === 0) {
      throw new Error(files.pathFromRepoRoot(path) + " did not match any files");

    // Otherwise, use the `update_index()` Git command to actually add
    // the files.
    } else {
      addedFiles.forEach(function(p) { gitlet.update_index(p, { add: true }); });
    }
  },

  // **rm()** removes files that match `path` from the index.
  rm: function(path, opts) {
    files.assertInRepo();
    config.assertNotBare();
    opts = opts || {};

    // Get the paths of all files in the index that match `path`.
    var filesToRm = index.matchingFiles(path);

    // Abort if `-f` was passed. The removal of files with changes is not supported.
    if (opts.f) {
      throw new Error("unsupported");

    // Abort if no files matched `path`.
    } else if (filesToRm.length === 0) {
      throw new Error(files.pathFromRepoRoot(path) + " did not match any files");

    // Abort if `path` is a directory and `-r` was not passed.
    } else if (fs.existsSync(path) && fs.statSync(path).isDirectory() && !opts.r) {
      throw new Error("not removing " + path + " recursively without -r");

    } else {

      // Get a list of all files that are to be removed and have also
      // been changed on disk.  If this list is not empty then abort.
      var changesToRm = util.intersection(diff.addedOrModifiedFiles(), filesToRm);
      if (changesToRm.length > 0) {
        throw new Error("these files have changes:\n" + changesToRm.join("\n") + "\n");

      // Otherwise, remove the files that match `path`. Delete them
      // from disk and remove from the index.
      } else {
        filesToRm.filter(fs.existsSync).forEach(fs.unlinkSync);
        filesToRm.forEach(function(p) { gitlet.update_index(p, { remove: true }); });
      }
    }
  },

  // **commit()** creates a commit object that represents the current
  // state of the index, writes the commit to the database and points
  // `HEAD` at the commit.
  commit: function(opts) {
    files.assertInRepo();
    config.assertNotBare();

    // Write a tree object that represents the current state of the
    // index.
    var treeHash = this.write_tree();

    var headDesc = refs.isHeadDetached() ? "detached HEAD" : refs.headBranchName();

    // If the hash of the new tree is the same as the hash of the tree
    // that the `HEAD` commit points at, abort because there is
    // nothing new to commit.
    if (refs.hash("HEAD") !== undefined &&
        treeHash === objects.treeHash(objects.read(refs.hash("HEAD")))) {
      throw new Error("# On " + headDesc + "\nnothing to commit, working directory clean");

    } else {

      // Abort if the repo is in the merge state and there are
      // unresolved merge conflicts.
      var conflictedPaths = index.conflictedPaths();
      if (merge.isMergeInProgress() && conflictedPaths.length > 0) {
        throw new Error(conflictedPaths.map(function(p) { return "U " + p; }).join("\n") +
                        "\ncannot commit because you have unmerged files\n");

      // Otherwise, do the commit.
      } else {

        // If the repo is in the merge state, use a pre-written merge
        // commit message.  If the repo is not in the merge state, use
        // the message passed with `-m`.
        var m = merge.isMergeInProgress() ? files.read(files.gitletPath("MERGE_MSG")) : opts.m;

        // Write the new commit to the database.
        var commitHash = objects.writeCommit(treeHash, m, refs.commitParentHashes());

        // Point `HEAD` at new commit.
        this.update_ref("HEAD", commitHash);

        // If `MERGE_HEAD` exists, the repo was in the merge
        // state. Remove `MERGE_HEAD` and `MERGE_MSG`to exit the merge
        // state.  Report that the merge is complete.
        if (merge.isMergeInProgress()) {
          fs.unlinkSync(files.gitletPath("MERGE_MSG"));
          refs.rm("MERGE_HEAD");
          return "Merge made by the three-way strategy";

        // Repo was not in the merge state, so just report that the
        // commit is complete.
        } else {
          return "[" + headDesc + " " + commitHash + "] " + m;
        }
      }
    }
  },

  // **branch()** creates a new branch that points at the commit that
  // `HEAD` points at.
  branch: function(name, opts) {
    files.assertInRepo();
    opts = opts || {};

    // If no branch `name` was passed, list the local branches.
    if (name === undefined) {
      return Object.keys(refs.localHeads()).map(function(branch) {
        return (branch === refs.headBranchName() ? "* " : "  ") + branch;
      }).join("\n") + "\n";

    // `HEAD` is not pointing at a commit, so there is no commit for
    // the new branch to point at.  Abort.  This is most likely to
    // happen if the repo has no commits.
    } else if (refs.hash("HEAD") === undefined) {
      throw new Error(refs.headBranchName() + " not a valid object name");

    // Abort because a branch called `name` already exists.
    } else if (refs.exists(refs.toLocalRef(name))) {
      throw new Error("A branch named " + name + " already exists");

    // Otherwise, create a new branch by creating a new file called
    // `name` that contains the hash of the commit that `HEAD` points
    // at.
    } else {
      this.update_ref(refs.toLocalRef(name), refs.hash("HEAD"));
    }
  },

  // **checkout()** changes the index, working copy and `HEAD` to
  // reflect the content of the passed `ref`.  `ref` might be a branch
  // name or a commit hash.
  checkout: function(ref, _) {
    files.assertInRepo();
    config.assertNotBare();

    // Get the hash of the commit to check out.
    var toHash = refs.hash(ref);

    // Abort if `ref` cannot be found.
    if (!objects.exists(toHash)) {
      throw new Error(ref + " did not match any file(s) known to Gitlet");

    // Abort if the hash to check out points to an object that is a
    // not a commit.
    } else if (objects.type(objects.read(toHash)) !== "commit") {
      throw new Error("reference is not a tree: " + ref);

    // Abort if `ref` is the name of the branch currently checked
    // out.  Abort if head is detached, `ref` is a commit hash and
    // `HEAD` is pointing at that hash.
    } else if (ref === refs.headBranchName() ||
               ref === files.read(files.gitletPath("HEAD"))) {
      return "Already on " + ref;
    } else {

      // Get a list of files changed in the working copy.  Get a list
      // of the files that are different in the head commit and the
      // commit to check out.  If any files appear in both lists then
      // abort.
      var paths = diff.changedFilesCommitWouldOverwrite(toHash);
      if (paths.length > 0) {
        throw new Error("local changes would be lost\n" + paths.join("\n") + "\n")

      // Otherwise, perform the checkout.
      } else {
        process.chdir(files.workingCopyPath());

        // If the ref is in the object database, it must be a hash and
        // so this checkout is detaching the head.
        var isDetachingHead = objects.exists(ref);

        // Get the list of differences between the current commit and
        // the commit to check out.  Write them to the working copy.
        workingCopy.write(diff.diff(refs.hash("HEAD"), toHash));

        // Write the commit being checked out to `HEAD`. If the head is
        // being detached, the commit hash is written directly to the
        // `HEAD` file.  If the head is not being detached,
        // the branch being checked out is written to `HEAD`.
        refs.write("HEAD", isDetachingHead ? toHash : "ref: " + refs.toLocalRef(ref));

        // Set the index to the contents of the commit being checked
        // out.
        index.write(index.tocToIndex(objects.commitToc(toHash)));

        // Report the result of the checkout.
        return isDetachingHead ?
          "Note: checking out " + toHash + "\nYou are in detached HEAD state." :
          "Switched to branch " + ref;
      }
    }
  },

  // **diff()** returns the differences between two versions of the repo.
  diff: function(ref1, ref2, opts) {
    files.assertInRepo();
    config.assertNotBare();

    // Abort if `ref1` was supplied, but it does not resolve to a hash.
    if (ref1 !== undefined && refs.hash(ref1) === undefined) {
      throw new Error("ambiguous argument " + ref1 + ": unknown revision");

    // Abort if `ref2` was supplied, but it does not resolve to a hash.
    } else if (ref2 !== undefined && refs.hash(ref2) === undefined) {
      throw new Error("ambiguous argument " + ref2 + ": unknown revision");

    // Otherwise, perform diff.
    } else {

      // Gitlet only shows the name of each changed file and whether
      // it was added, modified or deleted.  For simplicity, the
      // changed content is not shown.

      // The diff happens between two versions of the repo.  The first
      // version is either the hash that `ref1` resolves to, or the
      // index.  The second version is either the hash that `ref2`
      // resolves to, or the working copy.
      var nameToStatus = diff.nameStatus(diff.diff(refs.hash(ref1), refs.hash(ref2)));

      // Show the path of each changed file.
      return Object.keys(nameToStatus)
        .map(function(path) { return nameToStatus[path] + " " + path; })
        .join("\n") + "\n";
    }
  },

  // **remote()** records the locations of remote versions of this
  // repo.
  remote: function(command, name, path, _) {
    files.assertInRepo();

    // Abort if `command` is not "add".  Only "add" is supported.
    if (command !== "add") {
      throw new Error("unsupported");

    // Abort if repo already has a record for a remote called `name`.
    } else if (name in config.read()["remote"]) {
      throw new Error("remote " + name + " already exists");

    // Otherwise, add remote record.
    } else {

      // Write to the config file a record of the `name` and `path` of
      // the remote.
      config.write(util.assocIn(config.read(), ["remote", name, "url", path]));
      return "\n";
    }
  },

  // **fetch()** records the commit that the passed `branch` is at on
  // the passed `remote`.  It does not change the local branch.
  fetch: function(remote, branch, _) {
    files.assertInRepo();

    // Abort if a `remote` or `branch` not passed.
    if (remote === undefined || branch === undefined) {
      throw new Error("unsupported");

    // Abort if `remote` not recorded in config file.
    } else if (!(remote in config.read().remote)) {
      throw new Error(remote + " does not appear to be a git repository");

    } else {

      // Get the location of the remote.
      var remoteUrl = config.read().remote[remote].url;

      // Turn the unqualified branch name into a fully qualified remote ref eg
      // `[branch] -> refs/remotes/[remote]/[branch]`
      var remoteRef =  refs.toRemoteRef(remote, branch);

      // Go to the remote repo and get the hash of the commit that
      // `branch` is on.
      var newHash = util.remote(remoteUrl)(refs.hash, branch);

      // Abort if `branch` did not exist on the remote.
      if (newHash === undefined) {
        throw new Error("couldn't find remote ref " + branch);

      // Otherwise, perform the fetch.
      } else {

        // Note down the commit this repo currently thinks the remote
        // branch is on.
        var oldHash = refs.hash(remoteRef);

        // Get all the objects in the remote database and write them.
        // to the local database.  (This is an
        // inefficient way of getting all the objects required to
        // recreate the commit locally.)
        var remoteObjects = util.remote(remoteUrl)(objects.allObjects);
        remoteObjects.forEach(objects.write);

        // Set the contents of the file at
        // `.gitlet/refs/remotes/[remote]/[branch]` to `newHash`, the
        // hash of the commit that the remote branch is on.
        gitlet.update_ref(remoteRef, newHash);

        // Record the hash of the commit that the remote branch is on to
        // `FETCH_HEAD`.  (The user can call `gitlet merge FETCH_HEAD` to
        // merge the remote version of the branch into their local branch.
        // For more details, see `merge()`.)
        refs.write("FETCH_HEAD", newHash + " branch " + branch + " of " + remoteUrl);

        // Report the result of the fetch.
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
    var hashToWcDiff = diff.nameStatus(diff.diff(headHash));
    var headToHashDiff = diff.nameStatus(diff.diff(headHash, hash));
    return Object.keys(hashToWcDiff).filter(function(p) { return p in headToHashDiff; });
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
