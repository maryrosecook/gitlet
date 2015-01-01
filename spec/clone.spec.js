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

  it("should not throw if target path exists and is empty", function() {
    fs.mkdirSync("exists");
    g.clone("whatever", "exists");
  });

  it("should throw if target path exists and is not empty ", function() {
    fs.mkdirSync("exists");
    fs.writeFileSync(nodePath.join("exists", "here"), "here");
    expect(function() { g.clone("whatever", "exists"); })
      .toThrow("exists already exists and is not empty");
  });
});
