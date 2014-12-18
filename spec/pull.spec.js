var fs = require("fs");
var nodePath = require("path");
var g = require("../src/gitlet");
var objects = require("../src/objects");
var refs = require("../src/refs");
var testUtil = require("./test-util");

describe("pull", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.pull(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it("should not support git pull with no name", function() {
    g.init();
    expect(function() { g.pull(); }).toThrow("unsupported");
  });

  it("should throw if remote does not exist", function() {
    g.init();
    expect(function() { g.pull("origin"); })
      .toThrow("fatal: origin does not appear to be a git repository");
  });

  it("should pull and merge master if tracking branch", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();

    gr.add("1a/filea");
    gr.commit({ m: "first" });

    gr.add("1b/fileb");
    gr.commit({ m: "second" });

    process.chdir(localRepo);
    gl.init();
    testUtil.createStandardFileStructure();
    fs.unlinkSync("1b/fileb"); // rm local file to prove we got it into WC from remote
    gr.add("1a/filea");
    gr.commit({ m: "first" }); // need to add bullshit commits to avoid not valid a object

    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin"); // fetch to tell local repo about branch
    gl.branch(undefined, { u: "origin/master" }); // add branch as tracking
    gl.pull("origin");

    // check index
    expect(testUtil.index().length).toEqual(2);
    expect(testUtil.index()[0].path).toEqual("1a/filea");
    expect(testUtil.index()[1].path).toEqual("1b/fileb");

    // check working copy
    testUtil.expectFile("1a/filea", "filea");
    testUtil.expectFile("1b/fileb", "fileb");

    // check commit file tree
    var toc = objects.readCommitToc(refs.readHash("HEAD"));
    expect(Object.keys(toc).length).toEqual(2);
    expect(toc["1a/filea"]).toBeDefined();
    expect(toc["1b/fileb"]).toBeDefined();
  });
});
