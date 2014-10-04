var fs = require("fs");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

describe("init", function() {
  beforeEach(testUtil.createEmptyRepo);

  function expectGitletFilesAndDirectories() {
    expect(fs.existsSync(__dirname + "/tmp/.gitlet/objects/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/tmp/.gitlet/refs/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/tmp/.gitlet/refs/heads/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/tmp/.gitlet/refs/remotes/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/tmp/.gitlet/refs/remotes/origin/")).toEqual(true);

    testUtil.expectFile(__dirname + "/tmp/.gitlet/HEAD", "ref: refs/heads/master\n");
    testUtil.expectFile(__dirname + "/tmp/.gitlet/config", "\n");
  };

  it("should create .gitlet/ and all required dirs", function() {
    g.init();
    expectGitletFilesAndDirectories();
  });

  it("should not change anything if init run twice", function() {
    g.init();
    g.init();
    expectGitletFilesAndDirectories();
  });
});
