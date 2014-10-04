var fs = require("fs");
var files = require("./files");
var index = require("./index");
var objects = require("./objects");
var refs = require("./refs");
var diff = require("./diff");
var checkout = require("./checkout");
var util = require("./util");
var parseOptions = require("./parse-options");

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
          remotes: {
            origin: {}
          },
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

  branch: function(name, _) {
    files.assertInRepo();

    if (name === undefined) {
      return refs.readLocalHeads().map(function(branchName) {
        var marker = branchName === refs.readCurrentBranchName() ? "* " : "  ";
        return marker + branchName;
      }).join("\n") + "\n";
    } else if (refs.readHash("HEAD") === undefined) {
      throw "fatal: Not a valid object name: 'master'.";
    } else if (refs.readLocalHeads().filter(function(h) { return h === name; }).length > 0) {
      throw "fatal: A branch named '" + name + "' already exists.";
    } else {
      refs.write(refs.nameToBranchRef(name), refs.readHash("HEAD"));
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
      refs.write(refs.readTerminalRef(refToUpdate), hash);
    }
  },

  checkout: function(ref, _) {
    files.assertInRepo();

    var hash = refs.readHash(ref);
    if (!objects.readExists(hash)) {
      throw "error: pathspec " + ref + " did not match any file(s) known to gitlet."
    } else if (objects.type(objects.read(hash)) !== "commit") {
      throw "fatal: reference is not a tree: " + ref;
    } else {
      var paths = checkout.readChangedFilesCheckoutWouldOverwrite(hash);
      if (paths.length > 0) {
        throw "error: Aborting. Your local changes to these files would be overwritten:\n" +
	        paths.join("\n") + "\n";
      } else {
        process.chdir(files.repoDir());
        checkout.writeCheckout(ref);
        return objects.readExists(ref) ?
          "Note: checking out " + ref + "\nYou are in 'detached HEAD' state." :
          "Switched to branch '" + ref + "'\n";
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
        var nameToStatus = diff.readDiff(ref1, ref2);
        return Object.keys(nameToStatus)
          .map(function(path) { return nameToStatus[path] + " " + path; })
          .join("\n") + "\n";
      }
    }
  }
  // ,

  // remote: function(command, name, path, _) {
  //   files.assertInRepo();

  //   if (command !== "add") {
  //     throw "unsupported";
  //   }
  // }
};

var runCli = module.exports.runCli = function (argv) {
  var rawArgs = parseOptions(argv);
  var commandFnName = rawArgs._[2].replace(/-/g, "_");
  var fn = gitlet[commandFnName];
  var commandArgs = rawArgs._.slice(3);
  var unspecifiedArgs = Array
      .apply(null, new Array(fn.length - commandArgs.length - 1))
      .map(function() { return undefined; });
  return fn.apply(gitlet, commandArgs.concat(unspecifiedArgs).concat(rawArgs));
};

if (require.main === module) {
  var result = runCli(process.argv);
  if (result !== undefined) {
    console.log(result);
  }
}
