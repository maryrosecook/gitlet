var fs = require("fs");
var nodePath = require("path");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

var makeRemoteRepo = function() {
  process.chdir("../");
  fs.mkdirSync("sub");
  process.chdir("sub");
  fs.mkdirSync("repo2");
  process.chdir("repo2");
  return process.cwd();
};

describe("fetch", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.fetch(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it("should throw if remote does not exist", function() {
    g.init();
    expect(function() { g.fetch("origin"); })
      .toThrow("fatal: 'origin' does not appear to be a git repository");
  });

  it("should not support git fetch with no name", function() {
    g.init();
    expect(function() { g.fetch(); }).toThrow("unsupported");
  });

  it("should be able to fetch main branch on remote", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();
    gr.add("1a/filea");
    gr.commit({ m: "first" });
    gr.add("1b/fileb");
    gr.commit({ m: "second" });
    var remoteMasterHash = fs.readFileSync(".gitlet/refs/heads/master", "utf8");

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin");

    testUtil.expectFile(".gitlet/refs/remotes/origin/master", remoteMasterHash);
    ["21cb63f6", "63e0627e", "17653b6d", "5ceba65", // first commit
     "1c4100dd", "794ea686", "507bf191", "5ceba66"] // second commit
      .forEach(function(h) {
        var exp = fs.readFileSync(nodePath.join(remoteRepo, ".gitlet", "objects", h), "utf8");
        testUtil.expectFile(nodePath.join(".gitlet/objects", h), exp);
      });
  });
});
