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
      .toThrow("not a Gitlet repository");
  });

  it("should not support git pull with no name", function() {
    g.init();
    expect(function() { g.pull(); }).toThrow("unsupported");
  });

  it("should throw if in bare repo", function() {
    g.init({ bare: true });
    expect(function() { g.add(); })
      .toThrow("this operation must be run in a work tree");
  });

  it("should throw if remote does not exist", function() {
    g.init();
    expect(function() { g.pull("origin"); })
      .toThrow("origin does not appear to be a git repository");
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

  it("should say up to date if already up to date", function() {
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
    fs.unlinkSync("1b/fileb"); // rm local file to prove we got it into WC from remote
    gr.add("1a/filea");
    gr.commit({ m: "first" }); // add identical commits

    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin"); // fetch to tell local repo about branch
    gl.branch(undefined, { u: "origin/master" }); // add branch as tracking

    expect(gl.pull("origin")).toEqual("Already up-to-date");
  });

  it("should throw if pull without tracking branch", function() {
    // regression
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    testUtil.createStandardFileStructure();
    gr.init();
    gr.add("1a/filea");
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);

    expect(gl.pull("origin")).toEqual("master has no tracking branch");
  });
});
