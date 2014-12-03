var fs = require("fs");
var nodePath = require("path");
var files = require("./files");
var objects = require("./objects");
var config = require("./config");
var util = require("./util");

var refs = module.exports = {
  isRef: function(ref) {
    return isSymbolicRef(ref) ||
      isLocalHeadRef(ref) ||
      isRemoteHeadRef(ref);
  },

  readTerminalRef: function(ref) {
    if (ref === "HEAD" && !this.readIsHeadDetached()) {
      return files.read(files.gitletPath("HEAD")).match("ref: (refs/heads/.+)")[1];
    } else if (refs.isRef(ref)) {
      return ref;
    } else {
      return refs.toLocalRef(ref);
    }
  },

  readHash: function(refOrHash) {
    if (objects.readExists(refOrHash)) {
      return refOrHash;
    } else if (refs.readTerminalRef(refOrHash) === "HEAD" ||
               refs.readTerminalRef(refOrHash) === "MERGE_HEAD") {
      return files.read(files.gitletPath(refs.readTerminalRef(refOrHash)));
    } else if (refs.readExists(refs.readTerminalRef(refOrHash))) {
      return files.read(files.gitletPath(refs.readTerminalRef(refOrHash)));
    }
  },

  readIsHeadDetached: function() {
    return files.read(files.gitletPath("HEAD")).match("refs") === null;
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

  composeFetchHead: function(remoteRefs, remoteUrl) {
    return Object.keys(remoteRefs).map(function(name) {
      var notForMerge;
      if (name !== refs.readCurrentBranchName() || config.read().branch[name] === undefined) {
        notForMerge = " not-for-merge";
      } else {
        notForMerge = "";
      }

      return remoteRefs[name] + notForMerge + " branch " + name + " of " + remoteUrl;
    }).join("\n") + "\n";
  },

  readLocalHeads: function() {
    return fs.readdirSync(nodePath.join(files.gitletPath(), "refs", "heads"))
      .reduce(function(o, n) { return util.assocIn(o, [n, refs.readHash(n)]); }, {});
  },

  readExists: function(ref) {
    return ref !== undefined &&
      (isLocalHeadRef(ref) || isRemoteHeadRef(ref)) &&
      fs.existsSync(files.gitletPath(ref));
  },

  readCurrentBranchName: function() {
    if (!refs.readIsHeadDetached()) {
      return files.read(files.gitletPath("HEAD")).match("refs/heads/(.+)")[1];
    }
  }
};

function isLocalHeadRef(ref) {
  return ref !== undefined && ref.match("refs/heads/[A-Za-z-]+");
};

function isRemoteHeadRef(ref) {
  return ref !== undefined && ref.match("refs/remotes/[A-Za-z-]+/[A-Za-z-]+");
};

function isSymbolicRef(ref) {
  return ["HEAD", "FETCH_HEAD", "MERGE_HEAD"].indexOf(ref) !== -1;
};
