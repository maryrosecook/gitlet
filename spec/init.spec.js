var fs = require("fs");
var g = require("../gitlet");
var testUtil = require("./test-util");

describe("init", function() {
  beforeEach(testUtil.initTestDataDir);

  it("should create .gitlet/ and all required dirs", function() {
    g.init();

    expect(fs.existsSync(__dirname + "/testData/repo1/.gitlet/objects/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/testData/repo1/.gitlet/refs/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/testData/repo1/.gitlet/refs/heads/")).toEqual(true);
    testUtil.expectFile(__dirname + "/testData/repo1/.gitlet/HEAD", "ref: refs/heads/master\n")
    testUtil.expectFile(__dirname + "/testData/repo1/.gitlet/config",
                        "[core]\n  bare = false\n");
  });

  it("should not change anything if init run twice", function() {
    g.init();
    g.init();

    expect(fs.existsSync(__dirname + "/testData/repo1/.gitlet/objects/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/testData/repo1/.gitlet/refs/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/testData/repo1/.gitlet/refs/heads/")).toEqual(true);
    testUtil.expectFile(__dirname + "/testData/repo1/.gitlet/HEAD", "ref: refs/heads/master\n")
    testUtil.expectFile(__dirname + "/testData/repo1/.gitlet/config",
                        "[core]\n  bare = false\n");
  });

  it("should not crash when config is a directory", function() {
    var dir = __dirname + "/testData/repo1/";
    fs.mkdirSync(dir + 'config');
    g.init();
  });

  describe("bare repos", function() {
    it("should put all gitlet files and folders in root if specify bare", function() {
      g.init({ bare: true });

      expect(fs.existsSync(__dirname + "/testData/repo1/objects/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/testData/repo1/refs/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/testData/repo1/refs/heads/")).toEqual(true);
      testUtil.expectFile(__dirname + "/testData/repo1/HEAD", "ref: refs/heads/master\n")
      testUtil.expectFile(__dirname + "/testData/repo1/config",
                          "[core]\n  bare = true\n");
    });
  });
});
