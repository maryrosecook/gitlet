var fs = require('fs');
var path = require('path');

var gimlet = module.exports = {
  init: function() {
    if (inRepo()) return;

    createDirectoryStructure({
      ".git": {
        hooks: {},
        info: {},
        logs: {},
        objects: {},
        refs: {
          heads: {},
          remotes: {
            origin: {}
          },
          tags: {}
        }
      }
    });

    fs.writeFileSync(path.join(getGitDir(), "HEAD"), "ref: refs/heads/master\n");
  },

  add: function(pathSpec) {
    assertInRepo();

    if (typeof pathSpec === 'string') {

    } else {
      throw "Nothing specified, nothing added.";
    }
  },

  hash_object: function(file, opts) {
    assertInRepo();
    opts = opts || {};

    if (file !== undefined) {
      if (!fs.existsSync(file)) {
        throw "fatal: Cannot open '" + file + "': No such file or directory"
      } else {
        var fileContents = fs.readFileSync(file, "utf8");
        if (opts.w) {
          writeObject(fileContents);
        }

        return hash(fileContents);
      }
    }
  }
};

var writeObject = function(content) {
  var filePath = path.join(getGitDir(), "objects", hash(content));
  fs.writeFileSync(filePath, content);
};

var hash = function(string) {
  return string
    .split("")
    .map(function(c) { return c.charCodeAt(0); })
    .reduce(function(a, n) { return a + n; })
    .toString(16);
};

var getGitDir = function(dir) {
  if (dir === undefined) return getGitDir(process.cwd());
  if (fs.existsSync(dir)) {
    var gitDir = path.join(dir, ".git");
    return fs.existsSync(gitDir) ? gitDir : getGitDir(path.join("..", dir));
  }
};

var inRepo = function(cwd) {
  return getGitDir(cwd) !== undefined;
};

var assertInRepo = function() {
  if (!inRepo()) {
    throw "fatal: Not a git repository (or any of the parent directories): .git";
  }
};

var createDirectoryStructure = function(structure, prefix) {
  if (prefix === undefined) return createDirectoryStructure(structure, process.cwd());
  Object.keys(structure).forEach(function(dirName) {
    var dirPath = path.join(prefix, dirName);
    fs.mkdirSync(dirPath, "777");
    createDirectoryStructure(structure[dirName], dirPath);
  });
};
