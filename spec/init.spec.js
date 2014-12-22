var fs = require("fs");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

describe("init", function() {
  beforeEach(testUtil.initTestDataDir);

  it("should create .gitlet/ and all required dirs", function() {
    g.init();

    expect(fs.existsSync(__dirname + "/testData/repo1/.gitlet/objects/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/testData/repo1/.gitlet/refs/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/testData/repo1/.gitlet/refs/heads/")).toEqual(true);
    testUtil.expectFile(__dirname + "/testData/repo1/.gitlet/HEAD", "ref: refs/heads/master\n")
    testUtil.expectFile(__dirname + "/testData/repo1/.gitlet/config", "[core]\n");
  });

  it("should not change anything if init run twice", function() {
    g.init();
    g.init();

    expect(fs.existsSync(__dirname + "/testData/repo1/.gitlet/objects/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/testData/repo1/.gitlet/refs/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/testData/repo1/.gitlet/refs/heads/")).toEqual(true);
    testUtil.expectFile(__dirname + "/testData/repo1/.gitlet/HEAD", "ref: refs/heads/master\n")
    testUtil.expectFile(__dirname + "/testData/repo1/.gitlet/config", "[core]\n");
  });
});
