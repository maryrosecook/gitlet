var fs = require("fs");
var p = require("path");
var g = require("../gitlet");
var testUtil = require("./test-util");

describe("pull", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.pull(); })
      .toThrow("not a Gitlet repository");
  });

  it("should not support git pull with no name or no branch", function() {
    g.init();
    expect(function() { g.pull(); }).toThrow("unsupported");
    expect(function() { g.pull("origin"); }).toThrow("unsupported");
  });

  it("should throw if in bare repo", function() {
    g.init({ bare: true });
    expect(function() { g.add(); })
      .toThrow("this operation must be run in a work tree");
  });

  it("should throw if remote branch does not exist", function() {
    g.init();
    expect(function() { g.pull("origin", "master"); })
      .toThrow("origin does not appear to be a git repository");
  });

  it("should pull and merge master", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();

    gr.add(p.normalize("1a/filea"));
    gr.commit({ m: "first" });

    gr.add(p.normalize("1b/fileb"));
    gr.commit({ m: "second" });

    process.chdir(localRepo);
    gl.init();
    testUtil.createStandardFileStructure();
    fs.unlinkSync("1b/fileb"); // rm local file to prove we got it into WC from remote
    gr.add(p.normalize("1a/filea"));
    gr.commit({ m: "first" }); // need to add bullshit commits to avoid not valid a object

    gl.remote("add", "origin", remoteRepo);
    gl.pull("origin", "master");

    // check index
    expect(testUtil.index().length).toEqual(2);
    expect(testUtil.index()[0].path).toEqual(p.normalize("1a/filea"));
    expect(testUtil.index()[1].path).toEqual(p.normalize("1b/fileb"));

    // check working copy
    testUtil.expectFile("1a/filea", "filea");
    testUtil.expectFile("1b/fileb", "fileb");

    // check commit file tree
    var index = testUtil.index();
    expect(Object.keys(index).length).toEqual(2);
    expect(index[0].path).toEqual(p.normalize("1a/filea"));
    expect(index[1].path).toEqual(p.normalize("1b/fileb"));
  });

  it("should say up to date if already up to date", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();

    gr.add(p.normalize("1a/filea"));
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    gl.init();
    testUtil.createStandardFileStructure();
    fs.unlinkSync("1b/fileb"); // rm local file to prove we got it into WC from remote
    gr.add(p.normalize("1a/filea"));
    gr.commit({ m: "first" }); // add identical commits

    gl.remote("add", "origin", remoteRepo);

    expect(gl.pull("origin", "master")).toEqual("Already up-to-date");
  });
});
