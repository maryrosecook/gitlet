var fs = require("fs");
var nodePath = require("path");
var g = require("../src/gitlet");
var objects = require("../src/objects");
var refs = require("../src/refs");
var testUtil = require("./test-util");

describe("push", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.push(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it("should not support git push with no remote name", function() {
    g.init();
    expect(function() { g.push(); }).toThrow("unsupported");
  });

  it("should throw if remote does not exist", function() {
    g.init();
    expect(function() { g.push("origin"); })
      .toThrow("fatal: origin does not appear to be a git repository");
  });
});
