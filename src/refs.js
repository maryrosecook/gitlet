var fs = require("fs");
var nodePath = require("path");
var files = require("./files");
var objects = require("./objects");
var config = require("./config");
var util = require("./util");

var refs = module.exports = {
  isRef: function(ref) {
    return isSymbolicRef(ref) || isLocalHeadRef(ref) || isRemoteHeadRef(ref);
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
    } else {
      var terminalRef = refs.readTerminalRef(refOrHash);
      if (terminalRef === "FETCH_HEAD") {
        return this.readFetchHeadBranchToMerge(refs.readHeadBranchName());
      } else if (refs.readExists(terminalRef)) {
        return files.read(files.gitletPath(terminalRef));
      }
    }
  },

  readIsHeadDetached: function() {
    return files.read(files.gitletPath("HEAD")).match("refs") === null;
  },

  readIsCheckedOut: function(branch) {
    return !config.readIsBare() && refs.readHeadBranchName() === branch;
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
      var forMerge =  name === refs.readHeadBranchName() &&
          config.read().branch[name] !== undefined;

      return remoteRefs[name] + (forMerge ? "" : " not-for-merge") +
        " branch " + name + " of " + remoteUrl;
    }).join("\n") + "\n";
  },

  readFetchHeadBranchToMerge: function(branchName) {
    return util.lines(files.read(files.gitletPath("FETCH_HEAD")))
      .filter(function(l) { return l.match("not-for-merge") === null; })
      .filter(function(l) { return l.match("^.+ branch " + branchName + " of"); })
      .map(function(l) { return l.match("^([^ ]+) ")[1]; })[0];
  },

  readLocalHeads: function() {
    return fs.readdirSync(nodePath.join(files.gitletPath(), "refs", "heads"))
      .reduce(function(o, n) { return util.assocIn(o, [n, refs.readHash(n)]); }, {});
  },

  readRemoteHeads: function(remote) {
    var remoteHeadPath = nodePath.join(files.gitletPath(), "refs", "remotes", remote);
    if (fs.existsSync(remoteHeadPath)) {
      return fs.readdirSync(remoteHeadPath)
        .reduce(function(o, n) {
          return util.assocIn(o, [n, refs.readHash(refs.toRemoteRef(remote, n))]);
        }, {});
    } else {
      return [];
    }
  },

  readExists: function(ref) {
    return refs.isRef(ref) && fs.existsSync(files.gitletPath(ref));
  },

  readHeadBranchName: function() {
    if (!refs.readIsHeadDetached()) {
      return files.read(files.gitletPath("HEAD")).match("refs/heads/(.+)")[1];
    }
  },

  readCommitParentHashes: function() {
    var headHash = refs.readHash("HEAD");
    if (require("./merge").readIsMergeInProgress()) {
      return [headHash, refs.readHash("MERGE_HEAD")];
    } else if (headHash === undefined) {
      return [];
    } else {
      return [headHash];
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
