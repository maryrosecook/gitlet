var fs = require('fs');
var path = require('path');

var gimlet = module.exports = {
  init: function() {
    if (inRepo(getCurrentDirectory())) return;

    createDirectoryStructure(getCurrentDirectory(), {
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

    fs.writeFileSync(getCurrentDirectory() + ".git/HEAD", "ref: refs/heads/master\n");
  },

  hash_object: function(file, opts) {
    assertInRepo(getCurrentDirectory());
    opts = opts || {};

    if (file !== undefined) {
      if (!fs.existsSync(file)) {
        throw "fatal: Cannot open '" + file + "': No such file or directory"
      } else if (!opts.w) {
        var fileContents = fs.readFileSync(file, "utf8");
        var hashedContents = hash(fileContents);
        return hashedContents;
      }
    }
  }
};

var hash = function(string) {
  return string
    .split("")
    .map(function(c) { return c.charCodeAt(0); })
    .reduce(function(a, n) { return a + n; })
    .toString(16);
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
