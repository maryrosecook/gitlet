var fs = require("fs");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

describe("fetch", function() {
  beforeEach(testUtil.initTestDataDir);

  it("should throw if not in repo", function() {
    expect(function() { g.fetch(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it("should throw if remote does not exist", function() {
    g.init();
    expect(function() { g.fetch("origin"); })
      .toThrow("fatal: 'origin' does not appear to be a git repository");
  });

  it("should not support git fetch with no name", function() {
    g.init();
    expect(function() { g.fetch(); }).toThrow("unsupported");
  });
});
