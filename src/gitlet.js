var fs = require("fs");
var nodePath = require("path");
var files = require("./files");
var index = require("./index");
var objects = require("./objects");
var refs = require("./refs");
var diff = require("./diff");
var workingCopy = require("./working-copy");
var util = require("./util");
var parseOptions = require("./parse-options");
var config = require("./config");
var merge = require("./merge");
var commit = require("./commit");

var gitlet = module.exports = {
  init: function(opts) {
    if (files.inRepo()) { return; }
    opts = opts || {};

    var conf = config.objToStr({ core: { "": { bare: (opts.bare === true).toString() }}});
    var gitletStructure = {
      HEAD: "ref: refs/heads/master\n",
      config: conf,
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
      for (var i = 0; i < addedFiles.length; i++) {
        this.update_index(addedFiles[i], { add: true });
      }
    }
  },

  rm: function(path, opts) {
    files.assertInRepo();
    config.assertNotBare();
    opts = opts || {};

    var diskFiles = files.lsRecursive(path);
    var fileList = Object.keys(index.readToc()).
        filter(function(p) { return p === path || diskFiles.indexOf(p) !== -1; });
    if (opts.f) {
      throw new Error("unsupported");
    } else if (fileList.length === 0) {
      throw new Error(files.pathFromRepoRoot(path) + " did not match any files");
    } else if (fs.existsSync(path) && fs.statSync(path).isDirectory() && !opts.r) {
      throw new Error("not removing " + path + " recursively without -r");
    } else {
      var headToc = refs.readHash("HEAD") ? objects.readCommitToc(refs.readHash("HEAD")) : {}
      var wcDiff = diff.nameStatus(headToc, index.readWorkingCopyToc());
      var addedModified = Object.keys(wcDiff)
          .filter(function(p) { return wcDiff[p] !== diff.FILE_STATUS.DELETE; });
      var changesToRm = util.intersection(addedModified, fileList);

      if (changesToRm.length > 0) {
        throw new Error("these files have changes:\n" + changesToRm.join("\n") + "\n");
      } else {
        for (var i = 0; i < fileList.length; i++) {
          if (fs.existsSync(fileList[i])) {
            fs.unlinkSync(fileList[i]);
          }

          this.update_index(fileList[i], { remove: true });
        }
      }
    }
  },

  commit: function(opts) {
    files.assertInRepo();
    config.assertNotBare();

    var headHash = refs.readHash("HEAD");
    var treeHash = this.write_tree();
    var headDesc = refs.readIsHeadDetached() ? "detached HEAD" : refs.readHeadBranchName();

    if (headHash !== undefined &&
        treeHash === objects.treeHash(objects.read(headHash))) {
      throw new Error("# On " + headDesc + "\nnothing to commit, working directory clean");
    } else {
      var message = merge.readIsMergeInProgress() ?
          files.read(files.gitletPath("MERGE_MSG")) :
          opts.m;
      var commmitHash = objects.write(objects.composeCommit(treeHash,
                                                            message,
                                                            commit.readParentHashes()));
      this.update_ref("HEAD", commmitHash);
      if (merge.readIsMergeInProgress()) {
        var conflictedPaths = index.readConflictedPaths();
        if (conflictedPaths.length > 0) {
          throw new Error(conflictedPaths.map(function(p) { return "U " + p; }).join("\n") +
                          "\ncannot commit because you have unmerged files\n");
        } else {
          fs.unlinkSync(files.gitletPath("MERGE_MSG"));
          refs.rm("MERGE_HEAD");
          return "Merge made by the three-way strategy";
        }
      } else {
        return "[" + headDesc + " " + commmitHash + "] " + message;
      }
    }
  },

  branch: function(name, opts) {
    files.assertInRepo();
    opts = opts || {};

    if (name === undefined && opts.u === undefined) {
      return Object.keys(refs.readLocalHeads()).map(function(branch) {
        return (branch === refs.readHeadBranchName() ? "* " : "  ") + branch;
      }).join("\n") + "\n";
    } else if (refs.readHash("HEAD") === undefined) {
      throw new Error(refs.readHeadBranchName() + " not a valid object name");
    } else if (name === undefined && opts.u !== undefined) {
      var rem = opts.u.split("/");

      if (refs.readIsHeadDetached()) {
        throw new Error("HEAD is detached so could not set upstream to " + opts.u);
      } else if (!refs.readExists(refs.toRemoteRef(rem[0], rem[1]))) {
        throw new Error("the requested upstream branch " + opts.u + " does not exist");
      } else {
        config.write(util.assocIn(config.read(), ["branch", rem[1], "remote", rem[0]]));
        return refs.readHeadBranchName() + " tracking remote branch " + rem[0] + "/" + rem[1];
      }
    } else if (refs.readExists(refs.toLocalRef(name))) {
      throw new Error("A branch named " + name + " already exists");
    } else {
      this.update_ref(refs.toLocalRef(name), refs.readHash("HEAD"));
    }
  },

  checkout: function(ref, _) {
    files.assertInRepo();
    config.assertNotBare();

    var toHash = refs.readHash(ref);
    if (!objects.readExists(toHash)) {
      throw new Error(ref + " did not match any file(s) known to Gitlet");
    } else if (objects.type(objects.read(toHash)) !== "commit") {
      throw new Error("reference is not a tree: " + ref);
    } else if (ref === refs.readHeadBranchName() ||
               ref === files.read(files.gitletPath("HEAD"))) {
      return "Already on " + ref;
    } else {
      var paths = diff.readChangedFilesCommitWouldOverwrite(toHash);
      if (paths.length > 0) {
        throw new Error("local changes would be lost\n" + paths.join("\n") + "\n")
      } else {
        process.chdir(files.workingCopyPath());

        var fromHash = refs.readHash("HEAD");
        var isDetachingHead = objects.readExists(ref);
        workingCopy.write(diff.diff(objects.readCommitToc(fromHash),
                                    objects.readCommitToc(toHash)));
        refs.write("HEAD", isDetachingHead ? toHash : "ref: " + refs.toLocalRef(ref));
        index.write(index.tocToIndex(objects.readCommitToc(toHash)));
        return isDetachingHead ?
          "Note: checking out " + toHash + "\nYou are in detached HEAD state." :
          "Switched to branch " + ref;
      }
    }
  },

  diff: function(ref1, ref2, opts) {
    files.assertInRepo();
    config.assertNotBare();

    if (ref1 !== undefined && refs.readHash(ref1) === undefined) {
      throw new Error("ambiguous argument " + ref1 + ": unknown revision");
    } else if (ref2 !== undefined && refs.readHash(ref2) === undefined) {
      throw new Error("ambiguous argument " + ref2 + ": unknown revision");
    } else {
      if (opts["name-status"] !== true) {
        throw new Error("unsupported"); // for now
      } else {
        var nameToStatus = diff.readDiff(refs.readHash(ref1),
                                         refs.readHash(ref2));
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

  fetch: function(remote, _) {
    files.assertInRepo();

    if (remote === undefined) {
      throw new Error("unsupported");
    } else if (!(remote in config.read().remote)) {
      throw new Error(remote + " does not appear to be a git repository");
    } else {
      var remotePath = config.read().remote[remote].url;
      util.remote(remotePath, objects.readAllObjects)().forEach(objects.write);

      var giverRemoteRefs = util.remote(remotePath, refs.readLocalHeads)();
      var receiverRemoteRefs = refs.readRemoteHeads(remote);
      var changedRefs = Object.keys(giverRemoteRefs)
          .filter(function(b) { return giverRemoteRefs[b] !== receiverRemoteRefs[b]; });

      refs.write("FETCH_HEAD", refs.composeFetchHead(giverRemoteRefs, remotePath));
      changedRefs.forEach(function(b) {
        gitlet.update_ref(refs.toRemoteRef(remote, b), giverRemoteRefs[b])
      });

      var refUpdateReport = changedRefs.map(function(b) {
        return b + " -> " + remote + "/" + b +
          (merge.readIsForce(receiverRemoteRefs[b], giverRemoteRefs[b]) ? " (forced)" : "");
      });

      return ["From " + remotePath,
              "Count " + util.remote(remotePath, objects.readAllObjects)().length]
        .concat(refUpdateReport)
        .join("\n") + "\n";
    }
  },

  merge: function(ref, _) {
    files.assertInRepo();
    config.assertNotBare();

    var giverHash = refs.readHash(ref);
    if (refs.readIsHeadDetached()) {
      throw new Error("unsupported");
    } else if (giverHash === undefined || objects.type(objects.read(giverHash)) !== "commit") {
      throw new Error(ref + ": expected commit type");
    } else {
      var receiverHash = refs.readHash("HEAD");
      if (objects.readIsUpToDate(receiverHash, giverHash)) {
        return "Already up-to-date";
      } else {
        var paths = diff.readChangedFilesCommitWouldOverwrite(giverHash);
        if (paths.length > 0) {
          throw new Error("local changes would be lost\n" + paths.join("\n") + "\n");
        } else if (merge.readCanFastForward(receiverHash, giverHash)) {
          merge.writeFastForwardMerge(receiverHash, giverHash);
          return "Fast-forward";
        } else {
          merge.writeNonFastForwardMerge(receiverHash, giverHash, ref);
          if (merge.readHasConflicts(receiverHash, giverHash)) {
            return "Automatic merge failed. Fix conflicts and commit the result.";
          } else {
            return this.commit();
          }
        }
      }
    }
  },

  pull: function(remote, _) {
    files.assertInRepo();
    config.assertNotBare();

    this.fetch(remote);
    if (refs.readHash("FETCH_HEAD") === undefined) {
      return refs.readHeadBranchName() + " has no tracking branch";
    } else {
      return this.merge("FETCH_HEAD");
    }
  },

  push: function(remote, opts) {
    files.assertInRepo();
    opts = opts || {};

    var headBranch = refs.readHeadBranchName();
    if (remote === undefined) {
      throw new Error("unsupported");
    } else if (refs.readIsHeadDetached()) {
      throw new Error("you are not currently on a branch");
    } else if (!(remote in config.read().remote)) {
      throw new Error(remote + " does not appear to be a git repository");
    } else if (config.read().branch[refs.readHeadBranchName()] === undefined) {
      throw new Error("current branch " + headBranch + " has no upstream branch");
    } else {
      var remotePath = config.read().remote[remote].url;
      if (util.remote(remotePath, refs.readIsCheckedOut)(headBranch)) {
        throw new Error("refusing to update checked out branch " + headBranch);
      } else {
        var receiverHash = util.remote(remotePath, refs.readHash)(headBranch);
        var giverHash = refs.readHash(headBranch);
        var needsForce = !merge.readCanFastForward(receiverHash, giverHash);
        if (objects.readIsUpToDate(receiverHash, giverHash)) {
          return "Already up-to-date";
        } else if (needsForce && !opts.f) {
          throw new Error("failed to push some refs to " + remotePath);
        } else {
          objects.readAllObjects().forEach(util.remote(remotePath, objects.write));
          gitlet.update_ref(refs.toRemoteRef(remote, headBranch), giverHash);
          util.remote(remotePath, gitlet.update_ref)(refs.toLocalRef(headBranch), giverHash);
          return ["To " + remotePath,
                  "Count " + objects.readAllObjects().length,
                  headBranch + " -> " + headBranch].join("\n") + "\n";
        }
      }
    }
  },

  clone: function(remotePath, targetPath, opts) {
    opts = opts || {};

    if (remotePath === undefined || targetPath === undefined) {
      throw new Error("you must specify remote path and target path");
    } else if (!fs.existsSync(remotePath) || !files.inRepo(remotePath)) {
      throw new Error("repository " + remotePath + " does not exist");
    } else if (fs.existsSync(targetPath) && fs.readdirSync(targetPath).length > 0) {
      throw new Error(targetPath + " already exists and is not empty");
    } else {
      remotePath = nodePath.resolve(process.cwd(), remotePath);
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath)
      }

      util.remote(targetPath, function(headHash) {
        gitlet.init(opts);
        gitlet.remote("add", "origin", nodePath.relative(process.cwd(), remotePath));
        gitlet.fetch("origin");
        config.write(util.assocIn(config.read(), ["branch", "master", "remote", "origin"]));
        if (headHash !== undefined) {
          merge.writeFastForwardMerge(undefined, headHash);
        }
      })(util.remote(remotePath, refs.readHash)("HEAD"));

      return "Cloning into " + targetPath;
    }
  },

  update_index: function(path, opts) {
    files.assertInRepo();
    config.assertNotBare();
    opts = opts || {};

    var pathFromRoot = files.pathFromRepoRoot(path);
    var isOnDisk = fs.existsSync(path);
    var isInIndex = index.readHasFile(path, 0);

    if (isOnDisk && fs.statSync(path).isDirectory()) {
      throw new Error(pathFromRoot + " is a directory - add files inside\n");
    } else if (opts.remove && !isOnDisk && isInIndex) {
      if (index.readFileInConflict(path)) {
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
    return objects.writeTree(files.nestFlatTree(index.readToc()));
  },

  update_ref: function(refToUpdate, refToUpdateTo, _) {
    files.assertInRepo();

    var hash = refs.readHash(refToUpdateTo);
    if (!objects.readExists(hash)) {
      throw new Error(refToUpdateTo + " not a valid SHA1");
    } else if (!refs.isRef(refToUpdate)) {
      throw new Error("cannot lock the ref " + refToUpdate);
    } else if (objects.type(objects.read(hash)) !== "commit") {
      var branch = refs.readTerminalRef(refToUpdate);
      throw new Error(branch + " cannot refer to non-commit object " + hash + "\n")
    } else {
      refs.write(refs.readTerminalRef(refToUpdate), hash);
    }
  }
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
