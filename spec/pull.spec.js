var fs = require("fs");
var nodePath = require("path");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

describe("pull", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.pull(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it("should not support git pull with no name", function() {
    g.init();
    expect(function() { g.pull(); }).toThrow("unsupported");
  });
});
