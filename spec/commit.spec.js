var fs = require("fs");
var p = require("path");
var g = require("../gitlet");
var nodePath = require("path");
var testUtil = require("./test-util");

describe("commit", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.commit(); })
      .toThrow("not a Gitlet repository");
  });

  it("should throw if in bare repo", function() {
    g.init({ bare: true });
    expect(function() { g.commit(); })
      .toThrow("this operation must be run in a work tree");
  });

  it("should throw if nothing to commit now, but there were previous commits", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1b");
    g.commit({ m: "first" });

    expect(function() { g.commit(); })
      .toThrow("# On master\nnothing to commit, working directory clean");
  });

  it("should create commit file when initially commiting", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1b");
    g.commit({ m: "first" });

    var commitFile = fs.readFileSync(".gitlet/objects/60986c94", "utf8");
    expect(commitFile.split("\n")[0]).toEqual("commit 391566d4");
    expect(commitFile.split("\n")[1])
      .toEqual("Date:  Sat Aug 30 2014 09:16:45 GMT-0400 (EDT)");
    expect(commitFile.split("\n")[2]).toEqual("");
    expect(commitFile.split("\n")[3]).toEqual("    first");
  });

  it("should initial commit file should have no parents", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1b");
    g.commit({ m: "first" });
    fs.readFileSync(".gitlet/objects/60986c94", "utf8").split("\n")[1].match("Date:");
  });

  it("should store parent on all commits after first", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb", filec: "filec" });

    g.add("filea");
    g.commit({ m: "first" });
    var firstHash = fs.readFileSync(".gitlet/refs/heads/master", "utf8");

    g.add("fileb");
    g.commit({ m: "second" });
    var secondHash = fs.readFileSync(".gitlet/refs/heads/master", "utf8");

    g.add("filec");
    g.commit({ m: "third" });
    var thirdHash = fs.readFileSync(".gitlet/refs/heads/master", "utf8");

    expect(fs.readFileSync(".gitlet/objects/" + secondHash, "utf8").split("\n")[1]).toEqual("parent " + firstHash);
    expect(fs.readFileSync(".gitlet/objects/" + thirdHash, "utf8").split("\n")[1]).toEqual("parent " + secondHash);
  });

  it("should point current branch at commit when committing", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1b");
    g.commit({ m: "first" });
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("60986c94");
  });

  it("should record subsequent commit object", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1a");
    g.commit({ m: "first" });
    g.add("1b");
    g.commit({ m: "second" });

    var commitFileLines1 = fs.readFileSync(".gitlet/objects/17a11ad4", "utf8").split("\n");
    expect(commitFileLines1[0]).toEqual("commit 63e0627e");
    expect(commitFileLines1[3]).toEqual("    first");

    var commitFileLines2 = fs.readFileSync(".gitlet/objects/5b228c59", "utf8").split("\n");
    expect(commitFileLines2[0]).toEqual("commit 566d6fea");
    expect(commitFileLines2[4]).toEqual("    second");
  });

  it("should point current branch at subsequent commits", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1a");
    g.commit({ m: "first" });
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("17a11ad4");

    g.add("1b");
    g.commit({ m: "second" });
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("5b228c59");
  });

  it("should create commit without passing date", function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb" }});
    g.add("1");
    g.commit({ m: "first" });

    fs.readdirSync(".gitlet/objects/").forEach(function(filename) {
      var contents = fs.readFileSync(nodePath.join(".gitlet/objects", filename), "utf8");
      if (contents.split(" ")[0] === "commit") {
        var lines = contents.split("\n");

        var dateStr = lines[1].split(" ").slice(1).join(" ");
        expect(new Date(dateStr).getFullYear() > 2013).toEqual(true);

        expect(lines[2]).toEqual("");
        expect(lines[3]).toEqual("    first");
      }
    });
  });

  it("should complain nothing to commit if only changes are unstaged", function() {
    testUtil.createStandardFileStructure();
    g.init();
    g.add(p.normalize("1a/filea"));
    g.commit({ m: "first" });
    fs.writeFileSync("1a/filea", "somethingelse");
    expect(function() { g.commit({ m: "second" }); })
      .toThrow("# On master\nnothing to commit, working directory clean");
  });

  it("should allow commiting to other checked out branch", function() {
    testUtil.createStandardFileStructure();
    g.init();
    g.add(p.normalize("1a/filea"));
    g.commit({ m: "first" });

    g.branch("other");
    g.checkout("other");
    g.add(p.normalize("1b/fileb"));
    g.commit({ m: "second" });

    testUtil.expectFile(".gitlet/HEAD", "ref: refs/heads/other");
    testUtil.expectFile(".gitlet/refs/heads/other", "16b35712");
  });

  it("should not write commit if commit when unresolved merge in progress", function() {
    //       a
    //       |
    //       aa
    //      /  \
    // M aaa   aaaa
    //     \   /
    //       m      O <<<aaaa===aaa>>>

    g.init();
    testUtil.createDeeplyNestedFileStructure();
    g.add("filea");
    g.commit({ m: "a" });

    fs.writeFileSync("filea", "fileaa");
    g.add("filea");
    g.commit({ m: "aa" });

    g.branch("other");

    fs.writeFileSync("filea", "fileaaa");
    g.add("filea");
    g.commit({ m: "aaa" });

    g.checkout("other");

    fs.writeFileSync("filea", "fileaaaa");
    g.add("filea");
    g.commit({ m: "aaaa" });

    expect(g.merge("master"))
      .toEqual("Automatic merge failed. Fix conflicts and commit the result.");

    var origHeadHash = testUtil.headHash();

    expect(function() { g.commit(); })
      .toThrow("U filea\ncannot commit because you have unmerged files\n");

    expect(testUtil.headHash()).toEqual(origHeadHash);
  });

  describe("detached HEAD commits", function() {
    it("should report in det head when commit to detached HEAD", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add(p.normalize("1a/filea"));
      g.commit({ m: "first" });
      g.checkout("17a11ad4");

      g.add(p.normalize("1b/fileb"));
      expect(g.commit({ m: "second" })).toEqual("[detached HEAD 16b35712] second");
    });

    it("should point head at new commit when commit to detached HEAD", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add(p.normalize("1a/filea"));
      g.commit({ m: "first" });
      g.checkout("17a11ad4");

      g.add(p.normalize("1b/fileb"));
      g.commit({ m: "second" });
      testUtil.expectFile(".gitlet/HEAD", "16b35712");
    });

    it("should create commit file when committing", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add(p.normalize("1a/filea"));
      g.commit({ m: "first" });
      g.checkout("17a11ad4");

      g.add(p.normalize("1b/fileb"));
      g.commit({ m: "second" });
      testUtil.expectFile(".gitlet/HEAD", "16b35712");

      var commitFile = fs.readFileSync(".gitlet/objects/16b35712", "utf8");
      expect(commitFile.split("\n")[0]).toEqual("commit 794ea686");
      expect(commitFile.split("\n")[1]).toEqual("parent 17a11ad4");
      expect(commitFile.split("\n")[2])
        .toEqual("Date:  Sat Aug 30 2014 09:16:45 GMT-0400 (EDT)");
      expect(commitFile.split("\n")[3]).toEqual("");
      expect(commitFile.split("\n")[4]).toEqual("    second");
    });

    it("should mention detached head if nothing to commit", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add(p.normalize("1a/filea"));
      g.commit({ m: "first" });
      g.checkout("17a11ad4");

      expect(function() { g.commit({ m: "second" }); })
        .toThrow("# On detached HEAD\nnothing to commit, working directory clean");
    });
  });
});
