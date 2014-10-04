var fs = require("fs");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

describe("remote", function() {
  beforeEach(testUtil.createEmptyRepo);

  it("should throw if not in repo", function() {
    expect(function() { g.remote(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it("should throw if try to remove origin", function() {
    g.init();
    expect(function() { g.remote("remove"); }).toThrow("unsupported");
  });

  // it("should add origin", function() {

  // });

  // it("should throw if origin already exists", function() {

  // });
});
