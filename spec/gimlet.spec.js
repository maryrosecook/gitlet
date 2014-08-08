var fs = require('fs');
var g = require('../gimlet-api');

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

    it('should return undefined if no file specified', function() {
      g.init();
      expect(g.hash_object()).toBeUndefined();
    });

    it('should throw if file specified does not exist', function() {
      g.init();
      expect(function() { g.hash_object("not-there") })
        .toThrow("fatal: Cannot open 'not-there': No such file or directory");
    });

    it('should return unique (!) hash of contents when file passed with no -w', function() {
      g.init();

      fs.writeFileSync("a.txt", "taoehusnaot uhrs.ochurcaoh. usrcao.h usrc oa.husrc aosr.ot");
      expect(g.hash_object("a.txt")).toEqual("15ee");

      fs.writeFileSync("b.txt", "oetuhntoaehuntao hesuh sano.tuh snato.h usntaho .u");
      expect(g.hash_object("b.txt")).toEqual("1318");
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
