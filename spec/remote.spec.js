var fs = require("fs");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

describe("remote", function() {
  beforeEach(testUtil.initTestDataDir);

  it("should throw if not in repo", function() {
    expect(function() { g.remote(); })
      .toThrow("not a Gitlet repository");
  });

  it("should throw if try to remove origin", function() {
    g.init();
    expect(function() { g.remote("remove"); }).toThrow("unsupported");
  });

  it("should store url when add origin", function() {
    g.init();
    g.remote("add", "origin", "git@origin");
    var configFileLines = fs.readFileSync(".gitlet/config", "utf8").split("\n");
    expect(configFileLines[0]).toEqual("[remote \"origin\"]");
    expect(configFileLines[1]).toEqual("  url = git@origin");
  });

  it("should be able to add remote to bare repo", function() {
    g.init({ bare: true });
    g.remote("add", "origin", "git@origin");
    var configFileLines = fs.readFileSync("config", "utf8").split("\n");
    expect(configFileLines[0]).toEqual("[remote \"origin\"]");
    expect(configFileLines[1]).toEqual("  url = git@origin");
  });

  it("should store remote branch ref location when add origin", function() {
    g.init();
    g.remote("add", "origin", "git@origin");
    var configFileLines = fs.readFileSync(".gitlet/config", "utf8").split("\n");
    expect(configFileLines[0]).toEqual("[remote \"origin\"]");
  });

  it("should return newline when successfully add remote", function() {
    g.init();
    expect(g.remote("add", "origin", "git@origin")).toEqual("\n");
    var configFileLines = fs.readFileSync(".gitlet/config", "utf8").split("\n");
    expect(configFileLines[0]).toEqual("[remote \"origin\"]");
  });

  it("should be able to store more than one remote", function() {
    g.init();
    g.remote("add", "origin", "git@origin");
    g.remote("add", "heroku", "git@heroku");
    g.remote("add", "server", "git@server");
    var configFileLines = fs.readFileSync(".gitlet/config", "utf8").split("\n");
    expect(configFileLines[0]).toEqual("[remote \"origin\"]");
    expect(configFileLines[2]).toEqual("[remote \"heroku\"]");
    expect(configFileLines[4]).toEqual("[remote \"server\"]");
  });

  it("should throw if origin already exists", function() {
    g.init();
    g.remote("add", "origin", "git@origin");
    expect(function() { g.remote("add", "origin", "git@heroku"); })
      .toThrow("remote origin already exists");
  });
});
