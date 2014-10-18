var fs = require("fs");
var files = require("./files");
var index = require("./index");
var objects = require("./objects");
var refs = require("./refs");
var diff = require("./diff");
var checkout = require("./checkout");
var util = require("./util");
var parseOptions = require("./parse-options");
var config = require("./config");
var merge = require("./merge");

var gitlet = module.exports = {
  init: function(_) {
    if (files.inRepo()) { return; }

    files.writeFilesFromTree({
      ".gitlet": {
        HEAD: "ref: refs/heads/master\n",
        config: "\n",
        objects: {},
        refs: {
          heads: {},
        }
      }
    }, process.cwd());
  },

  add: function(path, _) {
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
      throw "error: " + pathFromRoot + ": does not exist\n";
    } else if (fs.statSync(path).isDirectory()) {
      throw "error: " + pathFromRoot + ": is a directory - add files inside instead\n";
    } else if (!index.readHasFile(path) && opts.add === undefined) {
      throw "error: " + pathFromRoot  + ": cannot add to the index - missing --add option?\n";
    } else {
      index.writeFile(path);
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

  write_tree: function(_) {
    files.assertInRepo();
    return objects.writeTree(files.nestFlatTree(index.read()));
  },

  commit: function(opts) {
    files.assertInRepo();

    var headHash = refs.readHash("HEAD");
    var treeHash = this.write_tree();
    var headDesc = refs.readIsHeadDetached() ? "detached HEAD" : refs.readCurrentBranchName();

    if (headHash !== undefined &&
        treeHash === objects.treeHash(objects.read(headHash))) {
      throw "# On " + headDesc + "\n" + "nothing to commit, working directory clean";
    } else {
      var parentHashes = headHash === undefined ? [] : [headHash];
      var commmitHash = objects.write(objects.composeCommit(treeHash, opts.m, parentHashes));
      this.update_ref("HEAD", commmitHash);
      return "[" + headDesc + " " + commmitHash + "] " + opts.m;
    }
  },

  branch: function(name, opts) {
    files.assertInRepo();
    opts = opts || {};

    if (name === undefined && opts.u === undefined) {
      return Object.keys(refs.readLocalHeads()).map(function(branch) {
        return (branch === refs.readCurrentBranchName() ? "* " : "  ") + branch;
      }).join("\n") + "\n";
    } else if (refs.readHash("HEAD") === undefined) {
      throw "fatal: Not a valid object name: 'master'.";
    } else if (name === undefined && opts.u !== undefined) {
      var rem = opts.u.split("/");

      if (refs.readIsHeadDetached()) {
        throw "fatal: could not set upstream of HEAD to " + opts.u +
          " when it does not point to any branch.";
      } else if (!refs.readExists(refs.toRemoteRef(rem[0], rem[1]))) {
        throw "error: the requested upstream branch '" + opts.u + "' does not exist";
      } else {
        config.write(util.assocIn(config.read(), ["branch", rem[1], "remote", rem[0]]));
        return "Branch " + refs.readCurrentBranchName() +
          " set up to track remote branch " + rem[1] + " from " + rem[0] + ".";
      }
    } else if (refs.readExists(refs.toLocalRef(name))) {
      throw "fatal: A branch named '" + name + "' already exists.";
    } else {
      refs.writeLocal(refs.toLocalRef(name), refs.readHash("HEAD"));
    }
  },

  update_ref: function(refToUpdate, refToUpdateTo, _) {
    files.assertInRepo();

    var hash = refs.readHash(refToUpdateTo);
    if (!objects.readExists(hash)) {
      throw "fatal: " + refToUpdateTo + ": not a valid SHA1";
    } else if (!refs.isRef(refToUpdate)) {
      throw "fatal: Cannot lock the ref " + refToUpdate + ".";
    } else if (objects.type(objects.read(hash)) !== "commit") {
      throw "error: Trying to write non-commit object " + hash + " to branch " +
        refs.readTerminalRef(refToUpdate) + "\n";
    } else {
      refs.writeLocal(refs.readTerminalRef(refToUpdate), hash);
    }
  },

  checkout: function(ref, _) {
    files.assertInRepo();

    var hash = refs.readHash(ref);
    if (!objects.readExists(hash)) {
      throw "error: pathspec " + ref + " did not match any file(s) known to gitlet."
    } else if (objects.type(objects.read(hash)) !== "commit") {
      throw "fatal: reference is not a tree: " + ref;
    } else if (ref === refs.readCurrentBranchName() || ref === refs.readHeadContent()) {
      return "Already on '" + ref + "'";
    } else {
      var paths = checkout.readChangedFilesCheckoutWouldOverwrite(hash);
      if (paths.length > 0) {
        throw "error: Aborting. Your local changes to these files would be overwritten:\n" +
	        paths.join("\n") + "\n";
      } else {
        process.chdir(files.repoDir());

        var fromHash = refs.readHash("HEAD");
        var isDetachingHead = objects.readExists(ref);
        checkout.writeWorkingCopy(fromHash, hash);
        refs.writeLocal("HEAD", isDetachingHead ? hash : "ref: " + refs.toLocalRef(ref));
        checkout.writeIndex(hash);
        return isDetachingHead ?
          "Note: checking out " + hash + "\nYou are in 'detached HEAD' state." :
          "Switched to branch '" + ref + "'";
      }
    }
  },

  diff: function(ref1, ref2, opts) {
    files.assertInRepo();

    if (ref1 !== undefined && refs.readHash(ref1) === undefined) {
      throw "fatal: ambiguous argument " + ref1 + ": unknown revision";
    } else if (ref2 !== undefined && refs.readHash(ref2) === undefined) {
      throw "fatal: ambiguous argument " + ref2 + ": unknown revision";
    } else {
      if (opts["name-status"] !== true) {
        throw "unsupported"; // for now
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
      throw "unsupported";
    } else if (name in config.read()["remote"]) {
      throw "fatal: remote " + name + " already exists.";
    } else if (command === "add") {
      config.write(util.assocIn(config.read(), ["remote", name, "url", path]));
      return "\n";
    }
  },

  fetch: function(remote, _) {
    files.assertInRepo();

    if (remote === undefined) {
      throw "unsupported";
    } else if (!(remote in config.read().remote)) {
      throw "fatal: '" + remote + "' does not appear to be a git repository";
    } else {
      var localUrl = files.repoDir();
      var remoteUrl = config.read().remote[remote].url;

      process.chdir(remoteUrl);
      var remoteRefs = refs.readLocalHeads();
      var remoteObjects = objects.readAllHashes().map(objects.read);

      process.chdir(localUrl);
      remoteObjects.forEach(objects.write);
      Object.keys(remoteRefs).forEach(function(r){refs.writeRemote(remote, r, remoteRefs[r])});
      refs.writeFetchHead(remoteRefs, remoteUrl);

      return "From " + remoteUrl + "\n" +
        "Count " + remoteObjects.length + "\n" +
        util.difference(Object.keys(remoteRefs), Object.keys(refs.readLocalHeads()))
          .map(function(b) { return "* [new branch] " + b + " -> " + remote + "/" + b; })
          .join("\n") + "\n";
    }
  },

  merge: function(ref, _) {
    files.assertInRepo();

    var fromHash = refs.readHash(ref);
    if (fromHash === undefined) {
      throw "merge: " + ref + " - not something we can merge";
    } else if (refs.readIsHeadDetached()) {
      throw "unsupported";
    } else if (objects.type(objects.read(fromHash)) !== "commit") {
      throw "error: " + ref + ": expected commit type, but the object " +
        "dereferences to " + objects.type(objects.read(fromHash)) + " type";
    } else {
      var intoHash = refs.readHash("HEAD");
      if (intoHash === fromHash || objects.readIsAncestor(intoHash, fromHash)) {
        return "Already up-to-date.";
      }
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

// pin date for ConnectJS
global.Date.prototype.toString = function() {
  return "Sat Aug 30 2014 09:16:45 GMT-0400 (EDT)";
};

if (require.main === module) {
  var result = runCli(process.argv);
  if (result !== undefined) {
    console.log(result);
  }
}
