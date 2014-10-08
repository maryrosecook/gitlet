var fs = require("fs");
var nodePath = require("path");
var files = require("./files");
var objects = require("./objects");
var util = require("./util");

var refs = module.exports = {
  isRef: function(ref) {
    return ref === "HEAD" || isLocalHeadRef(ref);
  },

  readTerminalRef: function(ref) {
    if (isRemoteHeadRef(ref)) {
      return ref;
    } else if (ref === "HEAD" && this.readIsHeadDetached()) {
      return "HEAD";
    } else if (ref === "HEAD" && !this.readIsHeadDetached()) {
      return readHeadContent().match("ref: (refs/heads/.+)")[1];
    } else if (isLocalHeadRef(ref)) {
      return ref;
    } else {
      return refs.nameToBranchRef(ref);
    }
  },

  readHash: function(refOrHash) {
    if (objects.readExists(refOrHash)) {
      return refOrHash;
    } else if (refs.readTerminalRef(refOrHash) === "HEAD") {
      return readHeadContent();
    } else if (refs.readExists(refs.readTerminalRef(refOrHash))) {
      return files.read(nodePath.join(files.gitletDir(), refs.readTerminalRef(refOrHash)));
    }
  },

  readIsHeadDetached: function() {
    return readHeadContent().match("refs") === null;
  },

  nameToBranchRef: function(name) {
    return "refs/heads/" + name;
  },

  writeLocal: function(ref, content) {
    if (ref === "HEAD") {
      fs.writeFileSync(nodePath.join(files.gitletDir(), "HEAD"), content);
    } else if (isLocalHeadRef(ref)) {
      fs.writeFileSync(nodePath.join(files.gitletDir(), ref), content);
    }
  },

  writeRemote: function(remote, name, content) {
    var tree = util.assocIn({}, ["refs", "remotes", remote, name, content]);
    files.writeFilesFromTree(tree, files.gitletDir());
  },

  readLocalHeads: function() {
    return fs.readdirSync(nodePath.join(files.gitletDir(), "refs/heads/"))
      .reduce(function(o, n) { return util.assocIn(o, [n, refs.readHash(n)]); }, {});
  },

  readExists: function(ref) {
    return ref !== undefined &&
      isLocalHeadRef(ref) &&
      fs.existsSync(nodePath.join(files.gitletDir(), ref));
  },

  readCurrentBranchName: function() {
    if (!refs.readIsHeadDetached()) {
      return readHeadContent().match("refs/heads/(.+)")[1];
    }
  }
};

function readHeadContent() {
  return files.read(nodePath.join(files.gitletDir(), "HEAD"));
};

function isLocalHeadRef(ref) {
  return ref !== undefined && ref.match("refs/heads/[A-Za-z-]+");
};

function isRemoteHeadRef(ref) {
  return ref !== undefined && ref.match("refs/remotes/[A-Za-z-]+/[A-Za-z-]+");
};
