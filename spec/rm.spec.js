var fs = require("fs");
var g = require("../src/gitlet");
var nodePath = require("path");
var testUtil = require("./test-util");

describe("rm", function() {
  beforeEach(testUtil.initTestDataDir);

  it("should throw if not in repo", function() {
    expect(function() { g.rm(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  describe("pathspec matching", function() {
    it("should throw rel path if in root and pathspec does not match files", function() {
      g.init();
      expect(function() { g.rm("blah"); })
        .toThrow("fatal: pathspec 'blah' did not match any files");
    });

    it("should throw rel path if not in root and pathspec does not match files", function() {
      g.init();
      testUtil.createFilesFromTree({ "1": { "2": {}}})
      process.chdir("1/2");
      expect(function() { g.rm("blah"); })
        .toThrow("fatal: pathspec '1/2/blah' did not match any files");
    });
  });
});
