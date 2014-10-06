var fs = require("fs");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

describe("branch", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.branch(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it("should throw if master has not been created", function() {
    g.init();
    expect(function() { g.branch("woo"); })
      .toThrow("fatal: Not a valid object name: 'master'.");
  });

  it("should create new branch pointed at HEAD when call branch w branch name", function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea"}});
    g.add("1/filea");
    g.commit({ m: "first" });
    g.branch("woo");
    testUtil.expectFile(".gitlet/refs/heads/woo", "48946d55");
  });

  it("should should leave master pointed at orig hash after branching", function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea"}});
    g.add("1/filea");
    g.commit({ m: "first" });
    testUtil.expectFile(".gitlet/refs/heads/master", "48946d55");
    g.branch("woo");
    testUtil.expectFile(".gitlet/refs/heads/master", "48946d55");
  });

  it("should return list of branches when called with no args", function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea"}});
    g.add("1/filea");
    g.commit({ m: "first" });
    g.branch("woo");
    g.branch("boo");
    expect(g.branch()).toEqual("  boo\n* master\n  woo\n");
  });

  it("should prevent branching if branch already exists", function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea"}});
    g.add("1/filea");
    g.commit({ m: "first" });
    g.branch("woo");
    expect(function() { g.branch("woo") })
      .toThrow("fatal: A branch named 'woo' already exists.");
  });
});
