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

  it("should throw if current branch does not have an upstream branch", function() {
    g.init();
    g.remote("add", "origin", "whatever");
    expect(function() { g.push("origin"); })
      .toThrow("fatal: Current branch master has no upstream branch");
  });

  it("should throw if try to push when head detached", function() {
    testUtil.createStandardFileStructure();
    g.init();
    g.add("1a/filea");
    g.commit({ m: "first" });
    g.checkout("17a11ad4");

    expect(function() { g.push("origin"); })
      .toThrow("fatal: You are not currently on a branch");
  });

  it("should not throw if current branch has an upstream branch", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();
    gr.add("1a/filea");
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    gl.init();
    testUtil.createStandardFileStructure();
    gr.add("1a/filea");
    gr.commit({ m: "first" }); // have to create commits to avoid "never heard of master"

    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin");
    gl.branch(undefined, { u: "origin/master" });

    gl.push("origin");
  });
});
