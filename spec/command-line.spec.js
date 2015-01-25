var fs = require("fs");
var g = require("../gitlet");
var testUtil = require("./test-util");

describe("gitlet cli", function() {
  beforeEach(testUtil.initTestDataDir);

  describe("missing args", function() {
    it("should allow two missing args (ref1 and ref2)", function() {
      g.init();
      expect(g.runCli(["node", "gitlet", "diff"])).toEqual("\n");
    });
  });

  it("should throw if no command passed", function() {
    g.init();
    expect(function() { g.runCli(["node", "gitlet"]); })
      .toThrow("you must specify a Gitlet command to run")
  });

  it("should throw if no command passed", function() {
    g.init();
    expect(function() { g.runCli(["node", "gitlet", "nonexistent"]); })
      .toThrow("'nonexistent' is not a Gitlet command")
  });

  describe("running each gitlet command under normal circs", function() {
    it("gitlet init a repo", function() {
      g.runCli(["node", "gitlet", "init"]);
      testUtil.expectFile(__dirname + "/testData/repo1/.gitlet/HEAD",
                          "ref: refs/heads/master\n");
    });

    it("gitlet add a file", function() {
      testUtil.createFilesFromTree({ "1": { filea: "filea" }});
      g.init();
      g.runCli(["node", "gitlet", "add", "1/filea"]);
      expect(testUtil.index()[0].path).toEqual("1/filea");
      expect(testUtil.index().length).toEqual(1);
    });

    it("gitlet make new branch", function() {
      testUtil.pinDate();

      testUtil.createFilesFromTree({ "1": { filea: "filea" }});
      g.init();
      g.add("1/filea");
      g.commit({ m: "blah" });
      g.runCli(["node", "gitlet", "branch", "woo"]);
      testUtil.expectFile(".gitlet/refs/heads/woo", "48cbafcc");

      testUtil.unpinDate();
    });

    it("commit", function() {
      testUtil.pinDate();

      testUtil.createFilesFromTree({ "1": { filea: "filea" }});
      g.init();
      g.add("1/filea");
      g.runCli(["node", "gitlet", "commit", "-m", "blah"]);
      testUtil.expectFile(".gitlet/refs/heads/master", "48cbafcc");

      testUtil.unpinDate();
    });

    it("update HEAD ref to prior commit", function() {
      testUtil.pinDate();

      g.init();
      testUtil.createStandardFileStructure();

      g.add("1a");
      g.commit({ m: "first" });
      g.add("1b");
      g.commit({ m: "second" });

      g.runCli(["node", "gitlet", "update-ref", "HEAD", "17a11ad4"]);

      expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("17a11ad4");

      testUtil.unpinDate();
    });

    it("should be able to write largish tree when no trees written yet", function() {
      g.init();
      testUtil.createStandardFileStructure();
      g.add("1b");
      expect(g.runCli(["node", "gitlet", "write-tree"])).toEqual("391566d4");
    });
  });
});
