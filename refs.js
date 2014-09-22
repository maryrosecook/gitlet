var fs = require('fs');
var nodePath = require('path');
var files = require('./files');
var objects = require('./objects');

var refs = module.exports = {
  isRef: function(ref) {
    return ref === "HEAD" || isLocalHeadRef(ref);
  },

  toLocalHead: function(ref) {
    if (ref === "HEAD") {
      return readHead();
    } else if (isLocalHeadRef(ref)) {
      return ref;
    } else {
      return refs.nameToBranchRef(ref);
    }
  },

  readExistentHash: function(ref) {
    if (objects.readExists(ref)) {
      return ref;
    } else if (refs.readExists(refs.toLocalHead(ref))) {
      return files.read(nodePath.join(files.gimletDir(), refs.toLocalHead(ref)));
    } else if (refs.readExists(refs.nameToBranchRef(ref))) {
      return files.read(nodePath.join(files.gimletDir(), refs.nameToBranchRef(ref)));
    }
  },

  nameToBranchRef: function(name) {
    return "refs/heads/" + name;
  },

  write: function(ref, content) {
    if (isLocalHeadRef(ref)) {
      files.write(nodePath.join(files.gimletDir(), ref), content);
    }
  },

  readLocalHeads: function() {
    return fs.readdirSync(nodePath.join(files.gimletDir(), "refs/heads/"));
  },

  readExists: function(ref) {
    return ref !== undefined &&
      isLocalHeadRef(ref) &&
      fs.existsSync(nodePath.join(files.gimletDir(), ref));
  },

  readCurrentBranchName: function() {
    if (readHead().match("refs")) {
      return readHead().match("refs/heads/(.+)")[1];
    }
  }
};

function readHead() {
  var content = files.read(nodePath.join(files.gimletDir(), "HEAD"));
  var refMatch = content.match("ref: (refs/heads/.+)");
  return refMatch ? refMatch[1] : content;
};

function isLocalHeadRef(ref) {
  return ref.match("refs/heads/[A-Za-z-]+");
};
