var fs = require("fs");
var nodePath = require("path");
var g = require("../src/gitlet");
var util = require("../src/util");
var testUtil = require("./test-util");

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
      .toThrow("fatal: origin does not appear to be a git repository");
  });

  it("should not support git fetch with no name", function() {
    g.init();
    expect(function() { g.fetch(); }).toThrow("unsupported");
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
    gl.fetch("origin");

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
    gl.fetch("origin");

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
    gl.fetch("origin");

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
    gl.fetch("origin");

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
    gl.fetch("origin");

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
    expect(gl.fetch("origin")).toMatch("From " + remoteRepo);
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
    expect(gl.fetch("origin")).toMatch("Count 4");
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
    expect(gl.fetch("origin")).toMatch("Count 8");
  });

  it("should set other branch to hash value it has on remote", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();

    gr.add("1a/filea");
    gr.commit({ m: "first" });
    gr.branch("other1");
    gr.branch("other2");

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);

    var fetchReport = gl.fetch("origin");
    expect(fetchReport).toMatch(/other1 -> origin\/other1/);
    expect(fetchReport).toMatch(/other2 -> origin\/other2/);
  });

  it("should format return value nicely", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();

    gr.add("1a/filea");
    gr.commit({ m: "first" });
    gr.branch("other1");
    gr.branch("other2");

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);

    expect(gl.fetch("origin")).toEqual("From " + remoteRepo + "\n" +
                                       "Count 4\n" +
                                       "master -> origin/master\n" +
                                       "other1 -> origin/other1\n" +
                                       "other2 -> origin/other2\n");
  });

  it("should not report any changed branches if all up to date", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();

    gr.add("1a/filea");
    gr.commit({ m: "first" });
    gr.branch("other1");
    gr.branch("other2");

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);

    gl.fetch("origin");
    expect(gl.fetch("origin")).toEqual("From " + remoteRepo + "\n" +
                                       "Count 4\n");
  });

  it("should report force updated branch forced and non forced non forced", function() {
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
    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin");

    process.chdir(remoteRepo);

    gr.add("1b/fileb");
    gr.commit({ m: "second" }); // just change something on master - no force

    // add fake commit and use it to amend
    gr.checkout("other");
    gr.add("1b/2b/filec");
    gr.commit({ m: "fake third" }); // add commit
    var orig = fs.readFileSync(".gitlet/objects/31ad4cf3", "utf8");
    var amended = orig.replace("parent 17a11ad4\n", "");
    var amendedCommitHash = util.hash(amended);
    var amendedCommitPath = ".gitlet/objects/" + amendedCommitHash;
    fs.writeFileSync(amendedCommitPath, amended);
    expect(orig.length > fs.readFileSync(amendedCommitPath, "utf8").length).toEqual(true);
    gr.update_ref("HEAD", amendedCommitHash);

    process.chdir(localRepo);

    expect(gl.fetch("origin")).toEqual("From " + remoteRepo + "\n" +
                                       "Count 14\n" +
                                       "master -> origin/master\n" +
                                       "other -> origin/other (forced)\n");
  });

  describe("fetch head", function() {
    it("should say that all branches not for merge if no tracking branches", function() {
      var gl = g, gr = g;
      var localRepo = process.cwd();
      var remoteRepo = testUtil.makeRemoteRepo();

      gr.init();
      testUtil.createStandardFileStructure();

      gr.add("1a/filea");
      gr.commit({ m: "first" });
      gr.branch("other1");

      process.chdir(localRepo);
      gl.init();
      gl.remote("add", "origin", remoteRepo);
      gl.fetch("origin");

      var fetchHeadLines = fs.readFileSync(".gitlet/FETCH_HEAD", "utf8").split("\n");
      expect(fetchHeadLines[0])
        .toEqual("17a11ad4 not-for-merge branch master of " + remoteRepo);
      expect(fetchHeadLines[1])
        .toEqual("17a11ad4 not-for-merge branch other1 of " + remoteRepo);
    });

    it("should say master not for merge if not a tracking branch", function() {
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
      gl.fetch("origin");

      var fetchHeadLines = fs.readFileSync(".gitlet/FETCH_HEAD", "utf8").split("\n");
      expect(fetchHeadLines[0])
        .toEqual("17a11ad4 not-for-merge branch master of " + remoteRepo);
    });

    it("should say master for merge if tracking branch", function() {
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
      gl.fetch("origin");
      gl.branch(undefined, { u: "origin/master" });
      gl.fetch("origin"); // have to fetch again - prev fetch not-for-merge - not tracking

      var fetchHeadLines = fs.readFileSync(".gitlet/FETCH_HEAD", "utf8").split("\n");
      expect(fetchHeadLines[0])
        .toEqual("17a11ad4 branch master of " + remoteRepo);
    });

    it("should say master not for merge if tracking branch but checked out other", function() {
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
      gl.fetch("origin");
      gl.branch(undefined, { u: "origin/master" });
      gl.branch("other");
      gl.checkout("other");
      gl.fetch("origin");

      var fetchHeadLines = fs.readFileSync(".gitlet/FETCH_HEAD", "utf8").split("\n");
      expect(fetchHeadLines[0])
        .toEqual("17a11ad4 not-for-merge branch master of " + remoteRepo);
    });

    it("should say other branch for merge if checked out and tracking", function() {
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
      gl.fetch("origin");
      gl.branch(undefined, { u: "origin/other" });
      gl.fetch("origin");

      var fetchHeadLines = fs.readFileSync(".gitlet/FETCH_HEAD", "utf8").split("\n");
      expect(fetchHeadLines[0])
        .toEqual("17a11ad4 not-for-merge branch master of " + remoteRepo); // sanity
      expect(fetchHeadLines[1])
        .toEqual("17a11ad4 branch other of " + remoteRepo);
    });
  });
});
