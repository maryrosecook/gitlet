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
});
