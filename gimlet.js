var fs = require('fs');

var gimlet = module.exports = {
  init: function() {
    var repoDir = process.cwd() + "/";
    if (isRepo(repoDir)) return;

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

    fs.writeFileSync(repoDir + ".git/HEAD", "ref: refs/heads/master\n");
  },

  hash_object: function() {
    var repoDir = process.cwd() + "/";
    assertInRepo(repoDir);
  }
};

var gitDirPath = function(dir) {
  if (fs.existsSync(dir)) {
    var gitDir = dir + ".git/";
    return fs.existsSync(gitDir) ? gitDir : gitDirPath("../" + dir);
  }
};

var isRepo = function(repoDir) {
  return gitDirPath(repoDir) !== undefined;
};

var assertInRepo = function(cwd) {
  if (!isRepo(cwd)) {
    throw "fatal: Not a git repository (or any of the parent directories): .git";
  }
};

var createDirectoryStructure = function(prefix, structure) {
  Object.keys(structure).forEach(function(dirName) {
    var dirPath = prefix + dirName;
    fs.mkdirSync(dirPath, "777");
    createDirectoryStructure(dirPath, structure[dirName]);
  });
};
