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
      .toThrow("not a Gitlet repository");
  });

  it("should not support git push with no remote name", function() {
    g.init();
    expect(function() { g.push(); }).toThrow("unsupported");
  });

  it("should throw if remote does not exist", function() {
    g.init();
    expect(function() { g.push("origin"); })
      .toThrow("origin does not appear to be a git repository");
  });

  it("should throw if current branch does not have an upstream branch", function() {
    g.init();
    g.remote("add", "origin", "whatever");
    expect(function() { g.push("origin"); })
      .toThrow("current branch master has no upstream branch");
  });

  it("should throw if try to push when head detached", function() {
    testUtil.createStandardFileStructure();
    g.init();
    g.add("1a/filea");
    g.commit({ m: "first" });
    g.checkout("17a11ad4");

    expect(function() { g.push("origin"); })
      .toThrow("you are not currently on a branch");
  });

  it("should throw if try push to non-bare repo where pushed branch checked out", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    testUtil.createStandardFileStructure();
    gr.init();
    gr.add("1a/filea");
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    testUtil.createStandardFileStructure();
    gl.init();
    gl.add("1a/filea");
    gl.commit({ m: "first" });

    process.chdir(remoteRepo);
    gr.remote("add", "origin", localRepo);
    gr.fetch("origin");
    gr.add("1b/fileb");
    gr.commit({ m: "second" });
    gr.branch(undefined, { u: "origin/master" });

    expect(function() { gr.push("origin"); })
      .toThrow("refusing to update checked out branch master");
  });

  it("should return up to date if try push current remote hash", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    testUtil.createStandardFileStructure();
    gr.init();
    gr.add("1a/filea");
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    testUtil.createStandardFileStructure();
    gl.init();
    gl.add("1a/filea");
    gr.commit({ m: "first" }); // have to add init commit so no "what is master" problems

    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin");
    gl.branch(undefined, { u: "origin/master" });

    process.chdir(remoteRepo);
    gr.init();
    gr.add("1b/fileb");
    gr.commit({ m: "second" });
    gr.branch("other");
    gr.checkout("other");

    process.chdir(localRepo);
    gl.pull("origin");

    expect(gl.push("origin")).toEqual("Already up-to-date.");
  });
});
