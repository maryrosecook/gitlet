var fs = require('fs');
var files = require('./files');
var index = require('./index');
var objects = require('./objects');
var refs = require('./refs');
var diff = require('./diff');
var util = require('./util');

var gimletApi = module.exports = {
  init: function() {
    if (files.inRepo()) { return; }

    files.writeFilesFromTree({
      ".gimlet": {
        HEAD: "ref: refs/heads/master\n",
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

  write_tree: function() {
    files.assertInRepo();
    return objects.writeTree(files.nestFlatTree(index.strToObj(index.read())));
  },

  commit: function(opts) {
    files.assertInRepo();

    if (Object.keys(index.strToObj(index.read())).length === 0) {
      throw "# On branch master\n#\n# Initial commit\n#\n" +
        "nothing to commit (create/copy files and use 'git add' to track)";
    } else {
      var headHash = refs.readHash("HEAD");
      var treeHash = this.write_tree();

      if (headHash !== undefined &&
          treeHash === objects.treeHash(objects.read(headHash))) {
        throw "# On " + refs.readCurrentBranchName() + "\n" +
          "nothing to commit, working directory clean";
      } else {
        var isFirstCommit = refs.readHash("HEAD") === undefined;
        var parentHashes = isFirstCommit ? [] : [refs.readHash("HEAD")];
        var commmitHash = objects.write(objects.composeCommit(treeHash, opts.m, parentHashes));
        this.update_ref("HEAD", commmitHash);
        return "[" + refs.readCurrentBranchName() + " " + commmitHash + "] " + opts.m;
      }
    }
  },

  branch: function(name) {
    files.assertInRepo();

    if (name === undefined) {
      return refs.readLocalHeads().map(function(branchName) {
        var marker = branchName === refs.readCurrentBranchName() ? "* " : "  ";
        return marker + branchName;
      }).join("\n") + "\n";
    } else if (refs.readHash("HEAD") === undefined) {
      throw "fatal: Not a valid object name: '" + refs.readCurrentBranchName() + "'.";
    } else {
      refs.write(refs.nameToBranchRef(name), refs.readHash("HEAD"));
    }
  },

  update_ref: function(refToUpdate, refToUpdateTo) {
    files.assertInRepo();

    if (!refs.isRef(refToUpdate)) {
      throw "fatal: Cannot lock the ref " + refToUpdate + ".";
    } else {
      var hash = objects.read(refToUpdateTo) ? refToUpdateTo : refs.readHash(refToUpdateTo);
      if (!objects.readExists(hash)) {
        throw "fatal: " + refToUpdateTo + ": not a valid SHA1";
      } else if (!(objects.type(objects.read(hash)) === "commit")) {
        throw "error: Trying to write non-commit object " + hash + " to branch " +
          refs.readTerminalRef(refToUpdate) + "\n" +
          "fatal: Cannot update the ref " + refToUpdate;
      } else {
        refs.write(refs.readTerminalRef(refToUpdate), hash);
      }
    }
  },

  checkout: function(ref) {
    files.assertInRepo();

    var finalRef = refs.isRef(ref) ? ref : refs.toFinalRef(ref);
    var hash = refs.toHash(finalRef);

    if (!objects.readExists(hash)) {
      throw "error: pathspec " + ref + " did not match any file(s) known to git."
    }
  },

  diff: function(ref1, ref2, opts) {
    files.assertInRepo();

    if (ref1 !== undefined && refs.readHash(ref1) === undefined) {
      throw "fatal: ambiguous argument " + ref1 + ": unknown revision";
    } else if (ref2 !== undefined && refs.readHash(ref2) === undefined) {
      throw "fatal: ambiguous argument " + ref2 + ": unknown revision";
    }
  }
};
