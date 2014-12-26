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
});
