var fs = require("fs");
var g = require("../src/gitlet");
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

  it("should not throw if target path exists and is empty", function() {
    var remoteRepo = testUtil.makeRemoteRepo();
    process.chdir(remoteRepo);
    g.init();
    process.chdir("../");

    fs.mkdirSync("exists");
    g.clone(remoteRepo, "exists");
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
});
