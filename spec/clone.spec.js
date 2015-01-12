var fs = require("fs");
var g = require("../src/gitlet");
var config = require("../src/config");
var nodePath = require("path");
var testUtil = require("./test-util");

describe("clone", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if no remote path specified", function() {
    expect(function() { g.clone(); })
      .toThrow("you must specify remote path and target path");
  });

  it("should throw if no target path specified", function() {
    expect(function() { g.clone("a"); })
      .toThrow("you must specify remote path and target path");
  });

  it("should throw if target path exists and is not empty ", function() {
    var remoteRepo = testUtil.makeRemoteRepo();
    process.chdir(remoteRepo);
    g.init();
    process.chdir("../");

    fs.mkdirSync("exists");
    fs.writeFileSync(nodePath.join("exists", "filea"), "filea");
    expect(function() { g.clone(remoteRepo, "exists"); })
      .toThrow("exists already exists and is not empty");
  });

  it("should throw if remote path exists but is not a git repo", function() {
    var remoteRepo = testUtil.makeRemoteRepo();
    expect(function() { g.clone(remoteRepo, "whatever"); })
      .toThrow("repository " + remoteRepo + " does not exist");
  });

  describe("successful clone", function() {
    var remoteRepo = "repo1";
    it("should write working copy after cloning", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      process.chdir("../");

      g.clone(remoteRepo, "local");
      process.chdir("local");
      testUtil.expectFile("1a/filea", "filea");
    });

    it("should set origin of new repo to remote", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      process.chdir("../");

      g.clone(remoteRepo, "local");
      process.chdir("local");
      expect(config.read().remote.origin.url).toEqual("../repo1");
    });

    it("should set master to track remote", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      process.chdir("../");

      g.clone(remoteRepo, "local");
      process.chdir("local");
      expect(config.read().branch.master.remote).toEqual("origin");
    });

    it("should return repo cloned when finished", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      process.chdir("../");

      expect(g.clone(remoteRepo, "local")).toEqual("Cloning into local");
    });

    it("should return repo cloned when finished", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      process.chdir("../");

      expect(g.clone(remoteRepo, "local")).toEqual("Cloning into local");
    });

    it("should set master to remote master hash", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      process.chdir("../");

      g.clone(remoteRepo, "local");
      process.chdir("local");
      testUtil.expectFile(".gitlet/refs/heads/master", "17a11ad4");
    });

    it("should write remote master hash index", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      process.chdir("../");

      g.clone(remoteRepo, "local");
      process.chdir("local");
      expect(testUtil.index()[0].path).toEqual("1a/filea");
      expect(testUtil.index()[0].hash).toEqual("5ceba65");
    });

    it("should be able to create bare clone of repo", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      process.chdir("../");

      g.clone(remoteRepo, "local", { bare: true });
      process.chdir("local");
      expect(config.isBare()).toEqual(true);
    });

    it("should be able to clone a bare repo", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      process.chdir("../");

      g.clone(remoteRepo, "localbare", { bare: true });
      g.clone("localbare", "localnotbare");

      process.chdir("localnotbare");
      testUtil.expectFile("1a/filea", "filea");
    });

    it("should be able to clone an empty repo", function() {
      testUtil.createStandardFileStructure();
      g.init();
      process.chdir("../");

      g.clone(remoteRepo, "local");
      process.chdir("local");
      expect(testUtil.index().length).toEqual(0);
    });
  });
});
