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
    if (isRemoteHeadRef(ref)) {
      return ref;
    } else if (ref === "HEAD" && !this.readIsHeadDetached()) {
      return refs.readSymbolicRefContent("HEAD").match("ref: (refs/heads/.+)")[1];
    } else if (isSymbolicRef(ref)) {
      return ref;
    } else if (isLocalHeadRef(ref)) {
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
      return refs.readSymbolicRefContent(refs.readTerminalRef(refOrHash));
    } else if (refs.readExists(refs.readTerminalRef(refOrHash))) {
      return files.readGitlet(refs.readTerminalRef(refOrHash));
    }
  },

  readIsHeadDetached: function() {
    return refs.readSymbolicRefContent("HEAD").match("refs") === null;
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
      files.writeFilesFromTree(tree, files.gitletDir());
    }
  },

  rm: function(ref) {
    if(refs.isRef(ref)) {
      fs.unlinkSync(nodePath.join(files.gitletDir(), ref));
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
    return fs.readdirSync(nodePath.join(files.gitletDir(), "refs/heads/"))
      .reduce(function(o, n) { return util.assocIn(o, [n, refs.readHash(n)]); }, {});
  },

  readExists: function(ref) {
    return ref !== undefined &&
      (isLocalHeadRef(ref) || isRemoteHeadRef(ref)) &&
      fs.existsSync(nodePath.join(files.gitletDir(), ref));
  },

  readCurrentBranchName: function() {
    if (!refs.readIsHeadDetached()) {
      return refs.readSymbolicRefContent("HEAD").match("refs/heads/(.+)")[1];
    }
  },

  readSymbolicRefContent: function(ref) {
    var path = nodePath.join(files.gitletDir(), ref);
    if (isSymbolicRef(ref) && fs.existsSync(path)) {
      return files.read(path);
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
