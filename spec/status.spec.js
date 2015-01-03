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

  it("should say what current branch is", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1a/filea");
    g.commit({ m: "first" });
    g.branch("other");
    g.checkout("other");

    expect(g.status()).toMatch(/On branch other/);
  });
});
