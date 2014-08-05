var fs = require('fs');

var init = exports.init = function(repoDir) {
  repoDir = repoDir || "./";

  createDirectoryStructure(repoDir, {
    ".git/": {
      "hooks/": {},
      "info/": {},
      "logs/": {},
      "objects/": {},
      "refs/": {
        "heads/": {},
        "remotes/": {
          "origin/": {}
        },
        "tags/": {}
      }
    }
  });
};

var createDirectoryStructure = function(prefix, structure) {
  Object.keys(structure).forEach(function(dirName) {
    var dirPath = prefix + dirName;
    fs.mkdirSync(dirPath, "777");
    createDirectoryStructure(dirPath, structure[dirName]);
  });
};
