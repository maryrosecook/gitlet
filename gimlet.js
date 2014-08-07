var fs = require('fs');

var gimlet = module.exports = {
  init: function() {
    if (inRepo(getCurrentDirectory())) return;

    var repoDir = getCurrentDirectory();

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
    assertInRepo(getCurrentDirectory());
  }
};

var getGitDir = function(dir) {
  if (fs.existsSync(dir)) {
    var gitDir = dir + ".git/";
    return fs.existsSync(gitDir) ? gitDir : getGitDir("../" + dir);
  }
};

var getCurrentDirectory = function() {
  return process.cwd() + "/";
};
var inRepo = function(cwd) {
  return getGitDir(cwd) !== undefined;
};

var assertInRepo = function(cwd) {
  if (!inRepo(cwd)) {
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
