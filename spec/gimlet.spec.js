var fs = require('fs');
var g = require('../gimlet');

describe('gimlet', function() {
  beforeEach(function() {
    var tmpDir = __dirname + "/tmp/";
    if (fs.existsSync(tmpDir)) {
      rmdirSyncRecursive(tmpDir);
    }

    fs.mkdirSync(tmpDir);
    process.chdir(tmpDir); // switch working dir to test repo root

    expect(fs.readdirSync(process.cwd()).length).toEqual(0);
  });

  describe('init', function() {
    var expectGitFilesAndDirectories = function() {
      expect(fs.existsSync(__dirname + "/tmp/.git/hooks/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.git/info/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.git/logs/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.git/objects/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.git/refs/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.git/refs/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.git/refs/heads/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.git/refs/remotes/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.git/refs/remotes/origin/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.git/refs/tags/")).toEqual(true);

      expect(fs.readFileSync(__dirname + "/tmp/.git/HEAD", "utf8"))
        .toEqual("ref: refs/heads/master\n");
    };

    it('should create .git/ and all required dirs', function() {
      g.init();
      expectGitFilesAndDirectories();
    });

    it('should not change anything if init run twice', function() {
      g.init();
      g.init();
      expectGitFilesAndDirectories();
    });
  });

  describe('hash-object', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.hash_object(); })
        .toThrow("fatal: Not a git repository (or any of the parent directories): .git");
    });

    it('should not throw if in repo', function() {
      g.init();
      g.hash_object();
    });
  });
});

var rmdirSyncRecursive = function(dir) {
  fs.readdirSync(dir).forEach(function(fileName) {
    var filePath = dir + fileName;
    if (fs.statSync(filePath).isDirectory()) {
      rmdirSyncRecursive(filePath + "/");
    } else {
      fs.unlinkSync(filePath);
    }
  });

  fs.rmdirSync(dir);
};
