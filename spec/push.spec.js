var fs = require("fs");
var p = require("path");
var g = require("../gitlet");
var testUtil = require("./test-util");

describe("push", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.push(); })
      .toThrow("not a Gitlet repository");
  });

  it("should not support git push with no remote name or branch name", function() {
    g.init();
    expect(function() { g.push(); }).toThrow("unsupported");
    expect(function() { g.push("origin"); }).toThrow("unsupported");
  });

  it("should throw if remote does not exist", function() {
    g.init();
    expect(function() { g.push("origin", "master"); })
      .toThrow("origin does not appear to be a git repository");
  });

  it("should throw if try push to non-bare repo where pushed branch checked out", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = testUtil.makeRemoteRepo();

    testUtil.createStandardFileStructure();
    gr.init();
    gr.add(p.normalize("1a/filea"));
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    testUtil.createStandardFileStructure();
    gl.init();
    gl.add(p.normalize("1a/filea"));
    gl.commit({ m: "first" });

    process.chdir(remoteRepo);
    gr.remote("add", "origin", localRepo);
    gr.fetch("origin", "master");
    gr.add(p.normalize("1b/fileb"));
    gr.commit({ m: "second" });

    expect(function() { gr.push("origin", "master"); })
      .toThrow("refusing to update checked out branch master");
  });

  it("should return up to date if try push current remote hash", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = "repo2";

    testUtil.createStandardFileStructure();
    gr.init();
    gr.add(p.normalize("1a/filea"));
    gr.commit({ m: "first" });
    gr.branch("other");
    gr.checkout("other");

    process.chdir("../");
    g.clone(localRepo, remoteRepo)
    process.chdir(remoteRepo);

    expect(gl.push("origin", "master")).toEqual("Already up-to-date");
  });

  it("should be able to push to bare repo", function() {
    var gl = g;
    var localRepo = process.cwd();
    var remoteRepo = "repo2";

    testUtil.createStandardFileStructure();
    gl.init();
    gl.add(p.normalize("1a/filea"));
    gl.commit({ m: "first" });

    process.chdir("../");
    g.clone(localRepo, remoteRepo, { bare: true });

    process.chdir(localRepo);
    gl.add(p.normalize("1b/fileb"));
    gl.commit({ m: "second" });
    gl.remote("add", "origin", "../repo2");

    expect(gl.push("origin", "master")).toMatch("master -> master");
  });

  it("should be able to push from bare repo", function() {
    var localRepo = process.cwd();
    var bareRepo = "repo2";
    var remoteRepo = "repo3";

    testUtil.createStandardFileStructure();
    g.init();
    g.add(p.normalize("1a/filea"));
    g.commit({ m: "first" });
    g.branch("other");
    g.checkout("other");

    process.chdir("../");
    g.clone(localRepo, remoteRepo);

    process.chdir(remoteRepo);
    fs.mkdirSync("1b");
    fs.writeFileSync("1b/fileb", "fileb");
    g.add(p.normalize("1b/fileb"));
    g.commit({ m: "second" });

    process.chdir("../");
    g.clone(remoteRepo, bareRepo, { bare: true });

    process.chdir(bareRepo);
    g.remote("add", "local", p.normalize("../repo1"));

    expect(fs.readFileSync("config", "utf8").split("\n")[5]).toEqual("  bare = true");
    expect(g.push("local", "master")).toMatch("master -> master");
  });

  describe("updating remote if push can be fast forwarded", function() {
    beforeEach(function() {
      var gl = g, gr = g;
      var localRepo = process.cwd();
      var remoteRepo = "repo2";

      testUtil.createStandardFileStructure();
      gl.init();
      gl.add(p.normalize("1a/filea"));
      gl.commit({ m: "first" });
      gl.branch("other");
      gl.checkout("other");

      process.chdir("../");
      g.clone(localRepo, remoteRepo);

      process.chdir(remoteRepo);
      fs.mkdirSync("1b");
      fs.writeFileSync("1b/fileb");
      gr.add(p.normalize("1b/fileb"));
      gr.commit({ m: "second" });
    });

    it("should return report of what happened", function() {
      expect(g.push("origin", "master", { f: true }))
        .toEqual("To " + p.normalize("../repo1") + "\nCount 8\nmaster -> master\n");
    });

    it("should set remote master to latest commit", function() {
      g.push("origin", "master", { f: true });
      process.chdir("../repo1");
      testUtil.expectFile(".gitlet/refs/heads/master", "352785f2");
    });

    it("should have sent commit object for newest commit", function() {
      g.push("origin", "master", { f: true });
      process.chdir("../repo1");
      expect(fs.existsSync(".gitlet/objects/352785f2")).toEqual(true);
    });

    it("should have updated remote's own refs/remotes/heads/master", function() {
      g.push("origin", "master", { f: true });
      testUtil.expectFile(".gitlet/refs/remotes/origin/master", "352785f2");
      expect(g.push("origin", "master")).toEqual("Already up-to-date");
    });
  });

  it("should throw if must be forced and -f not passed", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = "repo2";

    testUtil.createStandardFileStructure();
    gl.init();
    gl.add(p.normalize("1a/filea"));
    gl.commit({ m: "first" });
    gl.add(p.normalize("1b/fileb"));
    gl.commit({ m: "second" });
    gl.branch("other");
    gl.checkout("other");

    process.chdir("../");
    g.clone(localRepo, remoteRepo);

    process.chdir(remoteRepo);

    // amend second commit to be first (no parent) on remote
    var orig = fs.readFileSync(".gitlet/objects/16b35712", "utf8");
    var amended = orig.replace("parent 17a11ad4\n", "");
    var amendedCommitHash = testUtil.hash(amended);
    var amendedCommitPath = ".gitlet/objects/" + amendedCommitHash;
    fs.writeFileSync(amendedCommitPath, amended);
    expect(orig.length > fs.readFileSync(amendedCommitPath, "utf8").length).toEqual(true);
    gr.update_ref("HEAD", amendedCommitHash);

    expect(function() { gr.push("origin", "master"); })
      .toThrow("failed to push some refs to " + p.normalize("../repo1"));
  });

  describe("updating remote if push must be forced and -f passed", function() {
    beforeEach(function() {
      var gl = g, gr = g;
      var localRepo = process.cwd();
      var remoteRepo = "repo2";

      testUtil.createStandardFileStructure();
      gl.init();
      gl.add(p.normalize("1a/filea"));
      gl.commit({ m: "first" });
      gl.add(p.normalize("1b/fileb"));
      gl.commit({ m: "second" });
      gl.branch("other");
      gl.checkout("other");

      process.chdir("../");
      g.clone(localRepo, remoteRepo);

      process.chdir(remoteRepo);

      // amend second commit to be first (no parent) on remote
      var orig = fs.readFileSync(".gitlet/objects/16b35712", "utf8");
      var amended = orig.replace("parent 17a11ad4\n", "");
      var amendedCommitHash = testUtil.hash(amended);
      var amendedCommitPath = ".gitlet/objects/" + amendedCommitHash;
      fs.writeFileSync(amendedCommitPath, amended);
      expect(orig.length > fs.readFileSync(amendedCommitPath, "utf8").length).toEqual(true);
      gr.update_ref("HEAD", amendedCommitHash);
    });

    it("should return report of what happened", function() {
      expect(g.push("origin", "master", { f: true }))
        .toEqual("To " + p.normalize("../repo1") + "\nCount 9\nmaster -> master\n");
    });

    it("should set remote master to latest commit", function() {
      g.push("origin", "master", { f: true });
      process.chdir("../repo1");
      testUtil.expectFile(".gitlet/refs/heads/master", "6e3bfe70");
    });

    it("should have sent commit object for newest commit", function() {
      g.push("origin", "master", { f: true });
      process.chdir("../repo1");
      expect(fs.existsSync(".gitlet/objects/6e3bfe70")).toEqual(true);
    });

    it("should have updated remote's own refs/remotes/heads/master", function() {
      g.push("origin", "master", { f: true });
      testUtil.expectFile(".gitlet/refs/remotes/origin/master", "6e3bfe70");
      expect(g.push("origin", "master")).toEqual("Already up-to-date");
    });
  });
});
