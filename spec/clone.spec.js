var fs = require("fs");
var g = require("../src/gitlet");
var nodePath = require("path");
var testUtil = require("./test-util");

describe("clone", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if no remote path specified", function() {
    expect(function() { g.clone(); })
      .toThrow("you must specify remote path and target path");
  });

  it("should throw if no target path specified", function() {
    expect(function() { g.clone("a"); })
      .toThrow("you must specify remote path and target path");
  });
});
