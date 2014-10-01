var fs = require('fs');
var nodePath = require('path');
var files = require('./files');
var objects = require('./objects');

var refs = module.exports = {
  isRef: function(ref) {
    return ref === "HEAD" || isLocalHeadRef(ref);
  },

  readTerminalRef: function(ref) {
    if (ref === "HEAD") {
      return readHead();
    } else if (isLocalHeadRef(ref)) {
      return ref;
    } else {
      return refs.nameToBranchRef(ref);
    }
  },

  readHash: function(refOrHash) {
    if (refOrHash !== undefined) {
      if (objects.readExists(refOrHash)) {
        return refOrHash;
      } else if (refs.readExists(refs.readTerminalRef(refOrHash))) {
        return files.read(nodePath.join(files.gitletDir(), refs.readTerminalRef(refOrHash)));
      } else if (refs.readExists(refs.nameToBranchRef(refOrHash))) {
        return files.read(nodePath.join(files.gitletDir(), refs.nameToBranchRef(refOrHash)));
      }
    }
  },

  readIsHash: function(possibleHash) {
    return objects.read(possibleHash) !== undefined;
  },

  nameToBranchRef: function(name) {
    return "refs/heads/" + name;
  },

  write: function(ref, content) {
    if (ref === "HEAD") {
      files.write(nodePath.join(files.gitletDir(), "HEAD"), content);
    } else if (isLocalHeadRef(ref)) {
      files.write(nodePath.join(files.gitletDir(), ref), content);
    }
  },

  readLocalHeads: function() {
    return fs.readdirSync(nodePath.join(files.gitletDir(), "refs/heads/"));
  },

  readExists: function(ref) {
    return ref !== undefined &&
      isLocalHeadRef(ref) &&
      fs.existsSync(nodePath.join(files.gitletDir(), ref));
  },

  readCurrentBranchName: function() {
    if (readHead().match("refs")) {
      return readHead().match("refs/heads/(.+)")[1];
    }
  }
};

function readHead() {
  var content = files.read(nodePath.join(files.gitletDir(), "HEAD"));
  var refMatch = content.match("ref: (refs/heads/.+)");
  return refMatch ? refMatch[1] : content;
};

function isLocalHeadRef(ref) {
  return ref.match("refs/heads/[A-Za-z-]+");
};
