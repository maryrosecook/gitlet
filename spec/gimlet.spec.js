var fs = require('fs');
var pathLib = require('path');
var g = require('../gimlet-api');

var expectFile = function(path, content) {
  expect(fs.readFileSync(path, "utf8")).toEqual(content);
};

describe('gimlet', function() {
  beforeEach(function() {
    var tmpDir = __dirname + "/tmp";
    if (fs.existsSync(tmpDir)) {
      rmdirSyncRecursive(tmpDir);
    }

    fs.mkdirSync(tmpDir);
    process.chdir(tmpDir); // switch working dir to test repo root

    expect(fs.readdirSync(process.cwd()).length).toEqual(0);
  });

  describe('init', function() {
    var expectGimletFilesAndDirectories = function() {
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/hooks/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/info/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/logs/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/objects/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/heads/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/remotes/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/remotes/origin/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/tags/")).toEqual(true);

      expectFile(__dirname + "/tmp/.gimlet/HEAD", "ref: refs/heads/master\n");
    };

    it('should create .gimlet/ and all required dirs', function() {
      g.init();
      expectGimletFilesAndDirectories();
    });

    it('should not change anything if init run twice', function() {
      g.init();
      g.init();
      expectGimletFilesAndDirectories();
    });
  });

  describe('hash-object', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.hash_object(); })
        .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
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
      expect(g.hash_object("a.txt")).toEqual("7f9f2dae");

      fs.writeFileSync("b.txt", "oetuhntoaehuntao hesuh sano.tuh snato.h usntaho .u");
      expect(g.hash_object("b.txt")).toEqual("71dc6f5a");
    });

    it('should store blob and return hash when file passed with -w', function() {
      var content = "taoehusnaot uhrs.ochurcaoh. usrcao.h usrc oa.husrc aosr.ot";
      g.init();
      fs.writeFileSync("a.txt", content);
      expect(g.hash_object("a.txt", { w:true })).toEqual("7f9f2dae");
      expectFile(__dirname + "/tmp/.gimlet/objects/7f9f2dae", content);
    });

    it('should not store blob when -w not passed', function() {
      var content = "taoehusnaot uhrs.ochurcaoh. usrcao.h usrc oa.husrc aosr.ot";
      g.init();
      fs.writeFileSync("a.txt", content);

      var objectPath = __dirname + "/tmp/.gimlet/objects/" + g.hash_object("a.txt");
      expect(fs.existsSync(objectPath, "utf8")).toEqual(false);

      // check that file is stored with -w
      g.hash_object("a.txt", { w: true });
      expect(fs.existsSync(objectPath, "utf8")).toEqual(true);
    });
  });

  describe('add', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.add(); })
        .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
    });

    it('should throw if no pathspec passed', function() {
      g.init();
      expect(function() { g.add(); }).toThrow("Nothing specified, nothing added.");
    });

    describe('pathspec matching', function() {
      it('should throw rel path if in root and pathspec does not match files', function() {
        g.init();
        expect(function() {
          g.add("blah");
        }).toThrow("fatal: pathspec 'blah' did not match any files");
      });

      it('should throw rel path if not in root and pathspec does not match files', function() {
        g.init();
        createFilesFromTree({ "1": { "2": {}}})
        process.chdir("1/2");
        expect(function() {
          g.add("blah");
        }).toThrow("fatal: pathspec '1/2/blah' did not match any files");
      });
    });

    describe('adding files', function() {
      it('should add all files in a large dir tree', function() {
        g.init();
        createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                { "filec": "filec", "3":
                                  { "filed": "filed", "filee": "filee"}}}});
        g.add("1");
        expect(g.ls_files()[0]).toEqual("1/2/3/filed");
        expect(g.ls_files()[1]).toEqual("1/2/3/filee");
        expect(g.ls_files()[2]).toEqual("1/2/filec");
        expect(g.ls_files()[3]).toEqual("1/filea");
        expect(g.ls_files()[4]).toEqual("1/fileb");
        expect(g.ls_files().length).toEqual(5);
      });

      it('should add only files in specified subdir', function() {
        g.init();
        createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                { "filec": "filec", "3":
                                  { "filed": "filed", "filee": "filee"}}}});
        g.add("1/2");
        expect(g.ls_files()[0]).toEqual("1/2/3/filed");
        expect(g.ls_files()[1]).toEqual("1/2/3/filee");
        expect(g.ls_files()[2]).toEqual("1/2/filec");
        expect(g.ls_files().length).toEqual(3);
      });

      it('should be able to add multiple sets of files', function() {
        g.init();
        createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                { "filec": "filec", "3a":
                                  { "filed": "filed", "filee": "filee"}, "3b":
                                  { "filef": "filef", "fileg": "fileg"}}}});
        g.add("1/2/3a");
        expect(g.ls_files()[0]).toEqual("1/2/3a/filed");
        expect(g.ls_files()[1]).toEqual("1/2/3a/filee");
        expect(g.ls_files().length).toEqual(2);

        g.add("1/2/3b");
        expect(g.ls_files()[0]).toEqual("1/2/3a/filed");
        expect(g.ls_files()[1]).toEqual("1/2/3a/filee");
        expect(g.ls_files()[2]).toEqual("1/2/3b/filef");
        expect(g.ls_files()[3]).toEqual("1/2/3b/fileg");
        expect(g.ls_files().length).toEqual(4);
      });
    });
  });

  describe('update-index', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.update_index(); })
        .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
    });

    it('should return undefined if nothing specified', function() {
      g.init();
      expect(g.update_index()).toBeUndefined();
    });

    describe('pathspec stipulations', function() {
      it('should throw if path does not match existing working copy file', function() {
        g.init();
        expect(function() { g.update_index("blah"); })
          .toThrow("error: blah: does not exist\nfatal: Unable to process path blah");
      });

      it('should throw rel path if not in root and pathspec does not match file', function() {
        g.init();
        createFilesFromTree({ "1": { "2": {}}})
        process.chdir("1/2");
        expect(function() { g.update_index("blah"); })
          .toThrow("error: 1/2/blah: does not exist\nfatal: Unable to process path 1/2/blah");
      });

      it('should throw rel path if not in root and path is dir', function() {
        g.init();
        createFilesFromTree({ "1": { "2": {}}})
        process.chdir("1");
        expect(function() { g.update_index("2"); })
          .toThrow("error: 1/2: is a directory - add files inside instead\n" +
                   "fatal: Unable to process path 1/2");
      });
    });

    describe('adding files to index', function() {
      it('should add a file to an empty index and create object', function() {
        g.init();
        fs.writeFileSync("README.md", "this is a readme");
        g.update_index("README.md", { add: true });

        var readmeHash = g.hash_object("README.md");
        expectFile(pathLib.join(".gimlet/objects", readmeHash), "this is a readme");

        expect(g.ls_files()[0]).toEqual("README.md");
      });

      it('should add file to index with stuff in it', function() {
        g.init();
        createFilesFromTree({ "README1.md": "this is a readme1", "README2.md":"this is a readme2"});
        g.update_index("README1.md", { add: true });
        g.update_index("README2.md", { add: true });

        expectFile(pathLib.join(".gimlet/objects", g.hash_object("README1.md")),
                   "this is a readme1");
        expectFile(pathLib.join(".gimlet/objects", g.hash_object("README2.md")),
                   "this is a readme2");

        expect(g.ls_files()[0]).toEqual("README1.md");
        expect(g.ls_files()[1]).toEqual("README2.md");
      });

      it('should throw if try to add new file w/o --add flag', function() {
        g.init();
        fs.writeFileSync("README.md", "this is a readme");

        expect(function() { g.update_index("README.md"); })
          .toThrow("error: README.md: cannot add to the index - missing --add option?\n" +
                   "fatal: Unable to process path README.md");
      });

      it('should still refer to staged version if file changes after stage', function() {
        g.init();
        fs.writeFileSync("README.md", "this is a readme");
        var origContentHash = g.hash_object("README.md");
        g.update_index("README.md", { add: true });
        fs.writeFileSync("README.md", "this is a readme1");

        expectFile("README.md", "this is a readme1");
        expect(g.ls_files({ stage: true })[0].split(" ")[1]).toEqual(origContentHash);
      });

      it('should update file hash in index and add new obj if update file', function() {
        g.init();
        fs.writeFileSync("README.md", "this is a readme");
        g.update_index("README.md", { add: true });
        expect(g.ls_files({ stage: true })[0].split(" ")[1])
          .toEqual(g.hash_object("README.md")); // sanity check hash added for first version

        // update file and update index again
        fs.writeFileSync("README.md", "this is a readme1");
        g.update_index("README.md");

        var newVersionHash = g.ls_files({ stage: true })[0].split(" ")[1];

        expectFile(pathLib.join(".gimlet/objects", newVersionHash), "this is a readme1");
        expect(newVersionHash).toEqual(g.hash_object("README.md"));
      });
    });
  });

  describe('ls-files', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.ls_files(); })
        .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
    });

    it('should return no files if nothing in index', function() {
      g.init();
      expect(g.ls_files()).toEqual([]);
    });

    it('should return files in index', function() {
      g.init();
      createFilesFromTree({ "README1.md": "this is a readme1", "README2.md": "this is a readme2"});
      g.update_index("README1.md", { add: true });
      g.update_index("README2.md", { add: true });

      expect(g.ls_files()[0]).toEqual("README1.md");
      expect(g.ls_files()[1]).toEqual("README2.md");
    });

    it('should not return files not in index', function() {
      g.init();
      createFilesFromTree({ "README1.md": "this is a readme1", "README2.md": "this is a readme2"});
      g.update_index("README1.md", { add: true });

      expect(g.ls_files()[0]).toEqual("README1.md");
      expect(g.ls_files().length).toEqual(1);
    });

    it('should include full path in returned entries', function() {
      g.init();
      createFilesFromTree({ "src": { "README1.md": "this is a readme1"}});
      g.update_index("src/README1.md", { add: true });

      expect(g.ls_files()[0]).toEqual("src/README1.md");
    });

    it('should return files with hashes if --stage passed', function() {
      g.init();
      createFilesFromTree({ "README1.md": "this is a readme1", "README2.md": "this is a readme2"});
      g.update_index("README1.md", { add: true });
      g.update_index("README2.md", { add: true });

      expect(g.ls_files({stage: true})[0]).toEqual("README1.md " +g.hash_object("README1.md"));
      expect(g.ls_files({stage: true})[1]).toEqual("README2.md " +g.hash_object("README2.md"));
    });
  });

  describe('write-tree', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.write_tree(); })
        .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
    });

    it('should be able to write largish tree when no trees written yet', function() {
      g.init();
      createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                   { "filec": "filec", "3":
                                     { "filed": "filed", "filee": "filee"}}}});
      g.add("1");
      expect(g.write_tree()).toEqual("7afc965a");

      // check only trees
      expectFile(".gimlet/objects/7afc965a", "tree 380b9be6 1\n");
      expectFile(".gimlet/objects/380b9be6",
                 "tree 1c778a9 2\nblob 5ceba65 filea\nblob 5ceba66 fileb\n");
      expectFile(".gimlet/objects/1c778a9", "tree 51125fde 3\nblob 5ceba67 filec\n");
      expectFile(".gimlet/objects/51125fde", "blob 5ceba68 filed\nblob 5ceba69 filee\n");
    });

    it('should keep blobs written by git add', function() {
      g.init();
      createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                   { "filec": "filec", "3":
                                     { "filed": "filed", "filee": "filee"}}}});
      g.add("1");
      g.write_tree();

      // check only blobs
      expectFile(".gimlet/objects/5ceba65", "filea");
      expectFile(".gimlet/objects/5ceba66", "fileb");
      expectFile(".gimlet/objects/5ceba67", "filec");
      expectFile(".gimlet/objects/5ceba68", "filed");
      expectFile(".gimlet/objects/5ceba69", "filee");
    });

    it('should omit files in trees above dir that is several layers down', function() {
      g.init();
      createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                   { "filec": "filec", "3":
                                     { "filed": "filed", "filee": "filee"}}}});
      g.add("1/2");
      expect(g.write_tree()).toEqual("45cddb46");

      expectFile(".gimlet/objects/45cddb46", "tree 37ebbafc 1\n");
      expectFile(".gimlet/objects/37ebbafc", "tree 1c778a9 2\n");
      expectFile(".gimlet/objects/1c778a9", "tree 51125fde 3\nblob 5ceba67 filec\n");
      expectFile(".gimlet/objects/51125fde", "blob 5ceba68 filed\nblob 5ceba69 filee\n");
    });

    it('should compose tree from new and existing trees and blobs', function() {
      g.init();
      createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                   { "filec": "filec",
                                     "3a": { "filed": "filed", "filee": "filee"},
                                     "3b": { "filef": "filef", "fileg": "fileg"}}}});

      var _3aHash = "51125fde";
      var _3bHash = "3b5029be";

      g.add("1/2/3a");
      expect(g.write_tree()).toEqual("59431df");
      expectFile(".gimlet/objects/59431df", "tree 2711fbd9 1\n");
      expectFile(".gimlet/objects/2711fbd9", "tree 74f6972d 2\n");
      expectFile(".gimlet/objects/74f6972d", "tree " + _3aHash + " 3a\n");
      expectFile(".gimlet/objects/" + _3aHash, "blob 5ceba68 filed\nblob 5ceba69 filee\n");
      expect(fs.readdirSync(".gimlet/objects").length).toEqual(6);

      g.add("1/2/3b");
      expect(g.write_tree()).toEqual("53d8eab5");
      expectFile(".gimlet/objects/53d8eab5", "tree 494c2c41 1\n");
      expectFile(".gimlet/objects/494c2c41", "tree 9c02fdc 2\n");
      expectFile(".gimlet/objects/9c02fdc",
                 "tree " + _3aHash + " 3a\ntree " + _3bHash + " 3b\n");
      expectFile(".gimlet/objects/" + _3bHash, "blob 5ceba6a filef\nblob 5ceba6b fileg\n");
      expect(fs.readdirSync(".gimlet/objects").length).toEqual(12);
    });

    it('should write-tree of empty root tree if no files staged', function() {
      g.init();
      expect(g.write_tree()).toEqual("a");
    });
  });

  describe('commit', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.commit(); })
        .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
    });

    it('should throw and explain how to stage if index empty', function() {
      expect(function() {
        g.init();
        g.commit();
      }).toThrow("# On branch master\n#\n# Initial commit\n#\n" +
                 "nothing to commit (create/copy files and use 'git add' to track)");
    });

    it('should create commit file when initially commiting', function() {
      g.init();
      var date = new Date(1409404605356);
      createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                   { "filec": "filec", "3":
                                     { "filed": "filed", "filee": "filee"}}}});
      g.add("1");
      g.commit({ m: "first", date: date });

      var commitFile = fs.readFileSync(".gimlet/objects/1ff21fcc", "utf8");
      expect(commitFile.split("\n")[0]).toEqual("commit 7afc965a");
      expect(commitFile.split("\n")[1])
        .toEqual("Date:  Sat Aug 30 2014 09:16:45 GMT-0400 (EDT)");
      expect(commitFile.split("\n")[2]).toEqual("");
      expect(commitFile.split("\n")[3]).toEqual("    first");
    });

    it('should create commit without passing date', function() {
      g.init();
      createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb" }});
      g.add("1");
      g.commit({ m: "first" });

      fs.readdirSync(".gimlet/objects/").forEach(function(filename) {
        var contents = fs.readFileSync(pathLib.join(".gimlet/objects", filename)).toString();
        if (contents.split(" ")[0] === "commit") {
          var lines = contents.split("\n");

          var dateStr = lines[1].split(" ").slice(1).join(" ");
          expect(new Date(dateStr).getFullYear() > 2013).toEqual(true);

          expect(lines[2]).toEqual("");
          expect(lines[3]).toEqual("    first");
        }
      });
    });

  });

  describe('branch', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.branch(); })
        .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
    });
  });

  describe('update-ref', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.update_ref(); })
        .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
    });

    it('should throw if try to update ref that is not in refs/heads/', function() {
      g.init();
      expect(function() { g.update_ref("/", ""); }).toThrow("fatal: Cannot lock the ref /.");
      expect(function() { g.update_ref("refs/", ""); })
        .toThrow("fatal: Cannot lock the ref refs/.");
      expect(function() { g.update_ref("refs/heads", ""); })
        .toThrow("fatal: Cannot lock the ref refs/heads.");
      expect(function() { g.update_ref("refs/heads/", ""); })
        .toThrow("fatal: Cannot lock the ref refs/heads/.");
      expect(function() { g.update_ref("../woo", ""); })
        .toThrow("fatal: Cannot lock the ref ../woo.");
    });

    it('should throw if do not supply two strings', function() {
      g.init();
      expect(function() { g.update_ref(); }).toThrow("usage: see documentation");
      expect(function() { g.update_ref(""); }).toThrow("usage: see documentation");
    });

    it('should throw if ref2 is a hash that is not in the db', function() {
      g.init();
      expect(function() { g.update_ref("refs/heads/master", "123"); })
        .toThrow("fatal: 123: not a valid SHA1");
    });

    it('should throw if try to update HEAD to hash that is not a commit', function() {
      g.init();
      fs.writeFileSync("a", "a");
      var hash = g.hash_object("a", { w: true });
      expect(function() { g.update_ref("HEAD", hash); })
        .toThrow("error: Trying to write non-commit object " + hash +
                 " to branch refs/heads/master\n" +
                 "fatal: Cannot update the ref HEAD");
    });

    it('should throw if try to update master to hash that is not a commit', function() {
      g.init();
      fs.writeFileSync("a", "a");
      var hash = g.hash_object("a", { w: true });
      expect(function() { g.update_ref("refs/heads/master", hash); })
        .toThrow("error: Trying to write non-commit object " + hash +
                 " to branch refs/heads/master\n" +
                 "fatal: Cannot update the ref refs/heads/master");
    });
  });
});

var rmdirSyncRecursive = function(dir) {
  fs.readdirSync(dir).forEach(function(fileName) {
    var filePath = pathLib.join(dir, fileName);
    if (fs.statSync(filePath).isDirectory()) {
      rmdirSyncRecursive(filePath);
    } else {
      fs.unlinkSync(filePath);
    }
  });

  fs.rmdirSync(dir);
};

var createFilesFromTree = function(structure, prefix) {
  if (prefix === undefined) return createFilesFromTree(structure, process.cwd());

  Object.keys(structure).forEach(function(name) {
    var path = pathLib.join(prefix, name);
    if (typeof structure[name] === "string") {
      fs.writeFileSync(path, structure[name]);
    } else {
      fs.mkdirSync(path, "777");
      createFilesFromTree(structure[name], path);
    }
  });
};
