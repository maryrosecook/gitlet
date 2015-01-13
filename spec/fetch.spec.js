var fs = require("fs");
var nodePath = require("path");
var g = require("../gitlet");
var testUtil = require("./test-util");

describe("fetch", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.fetch(); })
      .toThrow("not a Gitlet repository");
  });

  it("should not support git fetch with no name or no branch", function() {
    g.init();
    expect(function() { g.fetch(); }).toThrow("unsupported");
    expect(function() { g.fetch("origin"); }).toThrow("unsupported");
  });

  it("should throw if remote does not exist", function() {
    g.init();
    expect(function() { g.fetch("origin", "master"); })
      .toThrow("origin does not appear to be a git repository");
  });

  it("should throw if remote branch does not exist", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();
    gr.add("1a/filea");
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);

    expect(function() { g.fetch("origin", "notthere"); })
      .toThrow("couldn't find remote ref notthere");
  });

  it("should be able to fetch objects for main branch on remote", function() {
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
    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin", "master");

    ["17a11ad4", "63e0627e", "17653b6d", "5ceba65", // first commit
     "16b35712", "794ea686", "507bf191", "5ceba66"] // second commit
      .forEach(function(h) {
        var exp = fs.readFileSync(nodePath.join(remoteRepo, ".gitlet", "objects", h), "utf8");
        testUtil.expectFile(nodePath.join(".gitlet/objects", h), exp);
      });
  });

  it("should be able to fetch objects for main branch on remote for bare repo", function() {
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
    gl.init({ bare: true });
    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin", "master");

    ["17a11ad4", "63e0627e", "17653b6d", "5ceba65", // first commit
     "16b35712", "794ea686", "507bf191", "5ceba66"] // second commit
      .forEach(function(h) {
        var exp = fs.readFileSync(nodePath.join(remoteRepo, ".gitlet", "objects", h), "utf8");
        testUtil.expectFile(nodePath.join("objects", h), exp);
      });
  });

  it("should set master to hash value it has on remote", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();
    gr.add("1a/filea");
    gr.commit({ m: "first" });
    var remoteMasterHash = fs.readFileSync(".gitlet/refs/heads/master", "utf8");

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin", "master");

    testUtil.expectFile(".gitlet/refs/remotes/origin/master", remoteMasterHash);
  });

  it("should be able to pull objects over only referenced by non-master branches", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();

    gr.add("1a/filea");
    gr.commit({ m: "first" });
    gr.branch("other");

    gr.checkout("other");
    gr.add("1b/fileb");
    gr.commit({ m: "second" });

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin", "other");

    ["17a11ad4", "63e0627e", "17653b6d", "5ceba65", // first commit
     "16b35712", "794ea686", "507bf191", "5ceba66"] // second commit
      .forEach(function(h) {
        var exp = fs.readFileSync(nodePath.join(remoteRepo, ".gitlet", "objects", h), "utf8");
        testUtil.expectFile(nodePath.join(".gitlet/objects", h), exp);
      });
  });

  it("should set other branch to hash value it has on remote", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();

    gr.add("1a/filea");
    gr.commit({ m: "first" });
    gr.branch("other");
    var remoteOtherHash = fs.readFileSync(".gitlet/refs/heads/other", "utf8");

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin", "other");

    testUtil.expectFile(".gitlet/refs/remotes/origin/other", remoteOtherHash);
  });

  it("should announce which origin it fetched from", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();
    gr.add("1a/filea");
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);
    expect(gl.fetch("origin", "master")).toMatch("From " + remoteRepo);
  });

  it("should announce total objects transferred from remote (all of them)", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();
    gr.add("1a/filea");
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);
    expect(gl.fetch("origin", "master")).toMatch("Count 4");
  });

  it("should announce count of all objs transf when some already transf", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();
    gr.add("1a/filea");
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);

    process.chdir(remoteRepo);
    gr.add("1b/fileb");
    gr.commit({ m: "second" });

    process.chdir(localRepo);
    expect(gl.fetch("origin", "master")).toMatch("Count 8");
  });

  it("should format return value nicely", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();

    gr.add("1a/filea");
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);

    expect(gl.fetch("origin", "master")).toEqual("From " + remoteRepo + "\n" +
                                                 "Count 4\n" +
                                                 "master -> origin/master\n");
  });

  it("should report force updated branch forced", function() {
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
    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin", "master");

    process.chdir(remoteRepo);

    var orig = fs.readFileSync(".gitlet/objects/16b35712", "utf8");
    var amended = orig.replace("parent 17a11ad4\n", "");
    var amendedCommitHash = "6e3bfe70";
    var amendedCommitPath = ".gitlet/objects/" + amendedCommitHash;
    fs.writeFileSync(amendedCommitPath, amended);
    expect(orig.length > fs.readFileSync(amendedCommitPath, "utf8").length).toEqual(true);
    gr.update_ref("HEAD", amendedCommitHash);

    process.chdir(localRepo);

    expect(gl.fetch("origin", "master")).toEqual("From " + remoteRepo + "\n" +
                                                 "Count 9\n" +
                                                 "master -> origin/master (forced)\n");
  });

  describe("fetch head", function() {
    it("should say master for merge if fetched", function() {
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
      gl.add("1a/filea");
      gl.commit({ m: "first" }); // need to add bullshit commits to avoid not valid a object

      gl.remote("add", "origin", remoteRepo);
      gl.fetch("origin", "master");

      var fetchHeadLines = fs.readFileSync(".gitlet/FETCH_HEAD", "utf8").split("\n");
      expect(fetchHeadLines[0])
        .toEqual("17a11ad4 branch master of " + remoteRepo);
    });

    it("should say other branch for merge if fetched", function() {
      var gl = g, gr = g;
      var localRepo = process.cwd();
      var remoteRepo = testUtil.makeRemoteRepo();

      gr.init();
      testUtil.createStandardFileStructure();

      gr.add("1a/filea");
      gr.commit({ m: "first" });
      gr.branch("other");

      process.chdir(localRepo);
      gl.init();
      testUtil.createStandardFileStructure();
      gl.add("1a/filea");
      gl.commit({ m: "first" }); // need to add bullshit commits to avoid not valid a object
      gl.remote("add", "origin", remoteRepo);

      gl.branch("other");
      gl.checkout("other");
      gl.fetch("origin", "other");

      expect(fs.readFileSync(".gitlet/FETCH_HEAD", "utf8").split("\n")[0])
        .toEqual("17a11ad4 branch other of " + remoteRepo);
    });

    it("should say other branch for merge even if on master and fetch other", function() {
      var gl = g, gr = g;
      var localRepo = process.cwd();
      var remoteRepo = testUtil.makeRemoteRepo();

      gr.init();
      testUtil.createStandardFileStructure();

      gr.add("1a/filea");
      gr.commit({ m: "first" });
      gr.branch("other");

      process.chdir(localRepo);
      gl.init();
      testUtil.createStandardFileStructure();
      gl.add("1a/filea");
      gl.commit({ m: "first" }); // need to add bullshit commits to avoid not valid a object
      gl.remote("add", "origin", remoteRepo);

      gl.fetch("origin", "other");

      expect(fs.readFileSync(".gitlet/FETCH_HEAD", "utf8").split("\n")[0])
        .toEqual("17a11ad4 branch other of " + remoteRepo);
    });

    it("should be able to fetch remote even if local has no commits", function() {
      var gl = g, gr = g;
      var localRepo = process.cwd();
      var remoteRepo = testUtil.makeRemoteRepo();

      gr.init();
      testUtil.createStandardFileStructure();

      gr.add("1a/filea");
      gr.commit({ m: "first" });

      process.chdir(localRepo);
      gl.init();
      gl.remote("add", "origin", remoteRepo);
      gl.fetch("origin", "master");

      expect(fs.readFileSync(".gitlet/FETCH_HEAD", "utf8").split("\n")[0])
        .toEqual("17a11ad4 branch master of " + remoteRepo);
    });
  });
});
