var fs = require('fs');
var ga = require('../gimlet-api');
var nodePath = require('path');
var testUtil = require('./test-util');

describe('update-index', function() {
  beforeEach(testUtil.createEmptyRepo);

  it('should throw if not in repo', function() {
    expect(function() { ga.update_index(); })
      .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
  });

  describe('pathspec stipulations', function() {
    it('should throw if path does not match existing working copy file', function() {
      ga.init();
      expect(function() { ga.update_index("blah"); })
        .toThrow("error: blah: does not exist\nfatal: Unable to process path blah");
    });

    it('should throw rel path if not in root and pathspec does not match file', function() {
      ga.init();
      testUtil.createFilesFromTree({ "1": { "2": {}}})
      process.chdir("1/2");
      expect(function() { ga.update_index("blah"); })
        .toThrow("error: 1/2/blah: does not exist\nfatal: Unable to process path 1/2/blah");
    });

    it('should throw rel path if not in root and path is dir', function() {
      ga.init();
      testUtil.createFilesFromTree({ "1": { "2": {}}})
      process.chdir("1");
      expect(function() { ga.update_index("2"); })
        .toThrow("error: 1/2: is a directory - add files inside instead\n" +
                 "fatal: Unable to process path 1/2");
    });
  });

  describe('adding files to index', function() {
    it('should add a file to an empty index and create object', function() {
      ga.init();
      fs.writeFileSync("README.md", "this is a readme");
      ga.update_index("README.md", { add: true });

      var readmeHash = ga.hash_object("README.md");
      testUtil.expectFile(nodePath.join(".gimlet/objects", readmeHash), "this is a readme");

      expect(testUtil.index()[0].path).toEqual("README.md");
    });

    it('should add file to index with stuff in it', function() {
      ga.init();
      testUtil.createFilesFromTree({ "README1.md": "this is a readme1", "README2.md":"this is a readme2"});
      ga.update_index("README1.md", { add: true });
      ga.update_index("README2.md", { add: true });

      testUtil.expectFile(nodePath.join(".gimlet/objects", ga.hash_object("README1.md")),
                          "this is a readme1");
      testUtil.expectFile(nodePath.join(".gimlet/objects", ga.hash_object("README2.md")),
                          "this is a readme2");

      expect(testUtil.index()[0].path).toEqual("README1.md");
      expect(testUtil.index()[1].path).toEqual("README2.md");
    });

    it('should throw if try to add new file w/o --add flag', function() {
      ga.init();
      fs.writeFileSync("README.md", "this is a readme");

      expect(function() { ga.update_index("README.md"); })
        .toThrow("error: README.md: cannot add to the index - missing --add option?\n" +
                 "fatal: Unable to process path README.md");
    });

    it('should still refer to staged version if file changes after stage', function() {
      ga.init();
      fs.writeFileSync("README.md", "this is a readme");
      var origContentHash = ga.hash_object("README.md");
      ga.update_index("README.md", { add: true });
      fs.writeFileSync("README.md", "this is a readme1");

      testUtil.expectFile("README.md", "this is a readme1");
      expect(testUtil.index()[0].hash).toEqual(origContentHash);
    });

    it('should update file hash in index and add new obj if update file', function() {
      ga.init();
      fs.writeFileSync("README.md", "this is a readme");
      ga.update_index("README.md", { add: true });
      expect(testUtil.index()[0].hash)
        .toEqual(ga.hash_object("README.md")); // sanity check hash added for first version

      // update file and update index again
      fs.writeFileSync("README.md", "this is a readme1");
      ga.update_index("README.md");

      var newVersionHash = testUtil.index()[0].hash;

      testUtil.expectFile(nodePath.join(".gimlet/objects", newVersionHash), "this is a readme1");
      expect(newVersionHash).toEqual(ga.hash_object("README.md"));
    });
  });
});
