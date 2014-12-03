var fs = require("fs");
var nodePath = require("path");
var files = require("./files");
var objects = require("./objects");
var diff = require("./diff");

var workingCopy = module.exports = {
  write: function(dif) {
    Object.keys(dif).forEach(function(p) {
      if (dif[p].status === diff.FILE_STATUS.ADD) {
        files.write(nodePath.join(files.repoDir(), p),
                    objects.read(dif[p].receiver || dif[p].giver));
      } else if (dif[p].status === diff.FILE_STATUS.MODIFY) {
        files.write(nodePath.join(files.repoDir(), p),
                    composeConflict(dif[p].receiver, dif[p].giver));
      } else if (dif[p].status === diff.FILE_STATUS.DELETE) {
        fs.unlinkSync(nodePath.join(files.repoDir(), p));
      }
    });

    rmEmptyDirs();
  }
};

function composeConflict(receiverFileHash, giverFileHash) {
  return "<<<<<<\n" + objects.read(receiverFileHash) +
    "\n======\n" + objects.read(giverFileHash) +
    "\n>>>>>>\n";
};

function rmEmptyDirs() {
  fs.readdirSync(files.repoDir())
    .filter(function(n) { return n !== ".gitlet"; })
    .forEach(files.rmEmptyDirs);
};
