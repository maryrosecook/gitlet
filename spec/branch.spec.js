var fs = require("fs");
var g = require("../gitlet");
var testUtil = require("./test-util");

describe("branch", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.branch(); })
      .toThrow("not a Gitlet repository");
  });

  it("should throw if master has not been created", function() {
    g.init();
    expect(function() { g.branch("woo"); })
      .toThrow("master not a valid object name");
  });

  it("should create new branch pointed at HEAD when call branch w branch name", function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea"}});
    g.add("1/filea");
    g.commit({ m: "first" });
    g.branch("woo");
    testUtil.expectFile(".gitlet/refs/heads/woo", "3606c2bf");
  });

  it("should should leave master pointed at orig hash after branching", function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea"}});
    g.add("1/filea");
    g.commit({ m: "first" });
    testUtil.expectFile(".gitlet/refs/heads/master", "3606c2bf");
    g.branch("woo");
    testUtil.expectFile(".gitlet/refs/heads/master", "3606c2bf");
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
      .toThrow("A branch named woo already exists");
  });

  it("should be able to branch on bare repo", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1a/filea");
    g.commit({ m: "first" });

    process.chdir("../");
    g.clone("repo1", "repo2");
    process.chdir("repo2");
    g.branch("other");
    testUtil.expectFile(".gitlet/refs/heads/other", "17a11ad4");
  });
});
