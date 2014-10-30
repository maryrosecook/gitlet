var fs = require("fs");
var g = require("../src/gitlet");
var nodePath = require("path");
var testUtil = require("./test-util");

describe("update-index", function() {
  beforeEach(testUtil.initTestDataDir);

  it("should throw if not in repo", function() {
    expect(function() { g.update_index(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  describe("pathspec stipulations", function() {
    it("should throw if path does not match existing working copy file", function() {
      g.init();
      expect(function() { g.update_index("blah"); })
        .toThrow("error: blah: does not exist and --remove not passed\n");
    });

    it("should throw rel path if not in root and pathspec does not match file", function() {
      g.init();
      testUtil.createFilesFromTree({ "1": { "2": {}}})
      process.chdir("1/2");
      expect(function() { g.update_index("blah"); })
        .toThrow("error: 1/2/blah: does not exist and --remove not passed\n");
    });

    it("should throw rel path if not in root and path is dir", function() {
      g.init();
      testUtil.createFilesFromTree({ "1": { "2": {}}})
      process.chdir("1");
      expect(function() { g.update_index("2"); })
        .toThrow("error: 1/2: is a directory - add files inside instead\n");
    });
  });

  describe("adding files to index", function() {
    it("should add a file to an empty index and create object", function() {
      g.init();
      fs.writeFileSync("README.md", "this is a readme");
      g.update_index("README.md", { add: true });

      var readmeHash = g.hash_object("README.md");
      testUtil.expectFile(nodePath.join(".gitlet/objects", readmeHash), "this is a readme");

      expect(testUtil.index()[0].path).toEqual("README.md");
    });

    it("should add file to index with stuff in it", function() {
      g.init();
      testUtil.createFilesFromTree({ "README1.md": "this is a readme1", "README2.md":"this is a readme2"});
      g.update_index("README1.md", { add: true });
      g.update_index("README2.md", { add: true });

      testUtil.expectFile(nodePath.join(".gitlet/objects", g.hash_object("README1.md")),
                          "this is a readme1");
      testUtil.expectFile(nodePath.join(".gitlet/objects", g.hash_object("README2.md")),
                          "this is a readme2");

      expect(testUtil.index()[0].path).toEqual("README1.md");
      expect(testUtil.index()[1].path).toEqual("README2.md");
    });

    it("should throw if try to add new file w/o --add flag", function() {
      g.init();
      fs.writeFileSync("README.md", "this is a readme");

      expect(function() { g.update_index("README.md"); })
        .toThrow("error: README.md: cannot add to the index - missing --add option?\n");
    });

    it("should still refer to staged version if file changes after stage", function() {
      g.init();
      fs.writeFileSync("README.md", "this is a readme");
      var origContentHash = g.hash_object("README.md");
      g.update_index("README.md", { add: true });
      fs.writeFileSync("README.md", "this is a readme1");

      testUtil.expectFile("README.md", "this is a readme1");
      expect(testUtil.index()[0].hash).toEqual(origContentHash);
    });

    it("should update file hash in index and add new obj if update file", function() {
      g.init();
      fs.writeFileSync("README.md", "this is a readme");
      g.update_index("README.md", { add: true });
      expect(testUtil.index()[0].hash)
        .toEqual(g.hash_object("README.md")); // sanity check hash added for first version

      // update file and update index again
      fs.writeFileSync("README.md", "this is a readme1");
      g.update_index("README.md");

      var newVersionHash = testUtil.index()[0].hash;

      testUtil.expectFile(nodePath.join(".gitlet/objects", newVersionHash), "this is a readme1");
      expect(newVersionHash).toEqual(g.hash_object("README.md"));
    });
  });
});
