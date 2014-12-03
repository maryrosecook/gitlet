var fs = require("fs");
var files = require("./files");
var objects = require("./objects");
var diff = require("./diff");

var workingCopy = module.exports = {
  write: function(dif) {
    Object.keys(dif).forEach(function(p) {
      if (dif[p].status === diff.FILE_STATUS.ADD) {
        files.write(files.repoPath(p), objects.read(dif[p].receiver || dif[p].giver));
      } else if (dif[p].status === diff.FILE_STATUS.MODIFY) {
        files.write(files.repoPath(p), composeConflict(dif[p].receiver, dif[p].giver));
      } else if (dif[p].status === diff.FILE_STATUS.DELETE) {
        fs.unlinkSync(files.repoPath(p));
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
  fs.readdirSync(files.repoPath())
    .filter(function(n) { return n !== ".gitlet"; })
    .forEach(files.rmEmptyDirs);
};
