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

  hash_object: function(commandArgs) {
    assertInRepo(getCurrentDirectory());

    var args = parseArgs(commandArgs);
    var filePath = args._[0];
    if (filePath !== undefined) {
      if (!fs.existsSync(filePath)) {
        throw "fatal: Cannot open '" + filePath + "': No such file or directory"
      } else if (!args.w) {
        var fileContents = fs.readFileSync(filePath, "utf8");
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

var parseArgs = function(commandLineArgs) {
  if (typeof commandLineArgs !== 'string') {
    return { _: [] };
  } else {
    var splitArgs = commandLineArgs.split(" ");
    var args = { _: splitArgs.filter(function (chunk) { return chunk[0] !== "-"; }) };

    return splitArgs
      .filter(function(chunk) { return chunk[0] === "-"; })
      .map(function(chunkWithDash) { return argWithDash.slice(1); })
      .reduce(function(args, arg) {
        args[arg] = true;
        return args;
      }, args);
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
