var fs = require("fs");
var nodePath = require("path");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

describe("status", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.push(); })
      .toThrow("not a Gitlet repository");
  });
});
