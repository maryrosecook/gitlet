var fs = require("fs");
var p = require("path");
var g = require("../gitlet");
var testUtil = require("./test-util");

describe("checkout", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.checkout(); })
      .toThrow("not a Gitlet repository");
  });

  it("should throw if in bare repo", function() {
    g.init({ bare: true });
    expect(function() { g.checkout(); })
      .toThrow("this operation must be run in a work tree");
  });

  it("should throw if pass ref that does not resolve to a hash", function() {
    g.init();
    expect(function() { g.checkout("woo"); })
      .toThrow("woo did not match any file(s) known to Gitlet");
  });

  it("should throw if passed ref points to blob", function() {
    testUtil.createStandardFileStructure();
    g.init();
    g.add(p.normalize("1a/filea"));
    g.commit({ m: "first" });
    expect(function() { g.checkout("5ceba65") })
      .toThrow("reference is not a tree: 5ceba65")
  });

  it("should throw if passed ref points to tree", function() {
    testUtil.createStandardFileStructure();
    g.init();
    g.add(p.normalize("1a/filea"));
    g.commit({ m: "first" });
    expect(function() { g.checkout("17653b6d") })
      .toThrow("reference is not a tree: 17653b6d")
  });

  it("should throw if file has unstaged changes w/o common orig content with c/o", function() {
    testUtil.createStandardFileStructure();
    g.init();

    g.add(p.normalize("1a/filea"));
    g.commit({ m: "first" });

    g.branch("other");

    fs.writeFileSync("1a/filea", "fileachange1");
    g.add(p.normalize("1a/filea"));
    g.commit({ m: "second" });

    fs.writeFileSync("1a/filea", "fileachange2");

    expect(function() { g.checkout("other"); })
      .toThrow("local changes would be lost\n" + p.normalize("1a/filea") + "\n");
  });

  it("should throw if file has unstaged changes even if they make it same as c/o", function() {
    testUtil.createStandardFileStructure();
    g.init();

    g.add(p.normalize("1a/filea"));
    g.commit({ m: "first" });

    g.branch("other");

    fs.writeFileSync("1a/filea", "fileachange1");
    g.add(p.normalize("1a/filea"));
    g.commit({ m: "second" });

    fs.writeFileSync("1a/filea", "filea");

    expect(function() { g.checkout("other"); })
      .toThrow("local changes would be lost\n" + p.normalize("1a/filea") + "\n");
  });

  it("should throw if file has staged changes w/o common orig content with c/o", function() {
    testUtil.createStandardFileStructure();
    g.init();

    g.add(p.normalize("1a/filea"));
    g.commit({ m: "first" });

    g.branch("other");

    fs.writeFileSync("1a/filea", "fileachange1");
    g.add(p.normalize("1a/filea"));
    g.commit({ m: "second" });

    fs.writeFileSync("1a/filea", "fileachange2");
    g.add(p.normalize("1a/filea"));

    expect(function() { g.checkout("other"); })
      .toThrow("local changes would be lost\n" + p.normalize("1a/filea") + "\n");
  });

  it("should list all files that would be overwritten when throwing", function() {
    testUtil.createStandardFileStructure();
    g.init();

    g.add(p.normalize("1a/filea"));
    g.add(p.normalize("1b/fileb"));
    g.add(p.normalize("1b/2b/filec"));
    g.commit({ m: "first" });

    g.branch("other");

    fs.writeFileSync("1a/filea", "fileachange1");
    fs.writeFileSync("1b/fileb", "fileachange1");
    fs.writeFileSync("1b/2b/filec", "fileachange1");
    g.add(p.normalize("1a/filea"));
    g.add(p.normalize("1b/fileb"));
    g.add(p.normalize("1b/2b/filec"));
    g.commit({ m: "second" });

    fs.writeFileSync("1a/filea", "fileachange2");
    fs.writeFileSync("1b/fileb", "fileachange2");
    fs.writeFileSync("1b/2b/filec", "fileachange2");

    expect(function() { g.checkout("other"); })
      .toThrow("local changes would be lost\n" + p.normalize("1a/filea") + "\n" + p.normalize("1b/fileb") + "\n" + p.normalize("1b/2b/filec") + "\n");
  });

  it("should not throw if file has changes w/ common orig content w/ c/o branch", function() {
    testUtil.createStandardFileStructure();
    g.init();

    g.add(p.normalize("1a/filea"));
    g.commit({ m: "first" });

    g.branch("other");
    fs.writeFileSync("1a/filea", "fileachange2");

    g.checkout("other"); // does not throw
  });

  it("should keep uncommitted changes compatible w checked out branch", function() {
    testUtil.createStandardFileStructure();
    g.init();

    g.add(p.normalize("1a/filea"));
    g.commit({ m: "first" });

    g.branch("other");
    fs.writeFileSync("1a/filea", "fileachange2");

    g.checkout("other");
    testUtil.expectFile("1a/filea", "fileachange2");
  });

  describe("successful checkout", function() {
    it("should remove committed files in previous working copy", function() {
      testUtil.createStandardFileStructure();
      g.init();

      g.add(p.normalize("1a/filea"));
      g.commit({ m: "first" });
      g.branch("other");

      g.add(p.normalize("1b/fileb"));
      g.commit({ m: "second" });

      g.checkout("other");
      expect(fs.existsSync("1b/fileb")).toEqual(false);
    });

    it("should add committed files in checked out ref", function() {
      testUtil.createStandardFileStructure();
      g.init();

      g.add(p.normalize("1a/filea"));
      g.commit({ m: "first" });
      g.branch("other");

      g.add(p.normalize("1b/fileb"));
      g.commit({ m: "second" });

      g.checkout("other");
      expect(fs.existsSync("1b/fileb")).toEqual(false); // sanity check

      g.checkout("master");
      expect(fs.existsSync("1b/fileb")).toEqual(true); // sanity check
    });

    it("should remove empty folders after checkout", function() {
      testUtil.createStandardFileStructure();
      g.init();

      g.add(p.normalize("1a/filea"));
      g.commit({ m: "first" });
      g.branch("other");

      g.add(p.normalize("1b/2b/3b/4b/filed"));
      g.commit({ m: "second" });

      g.checkout("other");
      expect(fs.existsSync("1b/2b/3b")).toEqual(false);
    });

    it("should not remove folders that have unindexed files", function() {
      testUtil.createStandardFileStructure();
      g.init();

      g.add(p.normalize("1a/filea"));
      g.commit({ m: "first" });
      g.branch("other");

      g.add(p.normalize("1b/2b/3b/4b/filed"));
      g.commit({ m: "second" });

      g.checkout("other");
      expect(fs.existsSync("1b/fileb")).toEqual(true);
    });

    it("should point head at checked out branch", function() {
      testUtil.createStandardFileStructure();
      g.init();

      g.add(p.normalize("1a/filea"));
      g.commit({ m: "first" });
      g.branch("other");

      g.add(p.normalize("1b/fileb"));
      g.commit({ m: "second" });

      g.checkout("other");
      testUtil.expectFile(".gitlet/HEAD", "ref: refs/heads/other");
    });

    it("should warn in detached head state if checkout commit", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add(p.normalize("1a/filea"));
      g.commit({ m: "first" });
      expect(g.checkout("17a11ad4"))
        .toEqual("Note: checking out 17a11ad4\nYou are in detached HEAD state.");
    });

    describe("index writing", function() {
      it("should remove files from index that are not in checked out branch", function() {
        testUtil.createStandardFileStructure();
        g.init();

        g.add(p.normalize("1a/filea"));
        g.commit({ m: "first" });
        g.branch("other");

        g.add(p.normalize("1b/fileb"));
        g.commit({ m: "second" });

        g.checkout("other");
        testUtil.expectFile(".gitlet/index", p.normalize("1a/filea") + " 0 5ceba65\n");
      });

      it("should add files to index that are now in checked out branch", function() {
        testUtil.createStandardFileStructure();
        g.init();

        g.add(p.normalize("1a/filea"));
        g.commit({ m: "first" });
        g.branch("other");

        g.add(p.normalize("1b/fileb"));
        g.commit({ m: "second" });

        g.checkout("other");
        testUtil.expectFile(".gitlet/index", p.normalize("1a/filea") + " 0 5ceba65\n");
        g.checkout("master");
        testUtil.expectFile(".gitlet/index", p.normalize("1a/filea") + " 0 5ceba65\n" + p.normalize("1b/fileb") + " 0 5ceba66\n");
      });
    });
  });

  it("should allow a commit hash to be passed", function() {
    testUtil.createStandardFileStructure();
    g.init();

    g.add(p.normalize("1a/filea"));
    g.commit({ m: "first" });
    g.add(p.normalize("1b/fileb"));
    g.commit({ m: "second" });
    g.checkout("17a11ad4");
    testUtil.expectFile(".gitlet/HEAD", "17a11ad4");
  });

  it("should be able to exit detached head state", function() {
    testUtil.createStandardFileStructure();
    g.init();
    g.add(p.normalize("1a/filea"));
    g.commit({ m: "first" });
    g.branch("other");
    g.add(p.normalize("1b/fileb"));
    g.commit({ m: "second" });
    g.checkout("17a11ad4");
    g.checkout("other");
    testUtil.expectFile(".gitlet/HEAD", "ref: refs/heads/other");
  });

  describe("repeated checkout of same thing", function() {
    describe("branch", function() {
      it("should say already on branch if try to check out current branch", function() {
        testUtil.createStandardFileStructure();
        g.init();

        g.add(p.normalize("1a/filea"));
        g.commit({ m: "first" });
        expect(g.checkout("master")).toEqual("Already on master");
      });

      it("should not meddle with wc on second checkout", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add(p.normalize("1a/filea"));
        g.commit({ m: "first" });
        fs.writeFileSync("1a/filea", "somethingelse");
        g.add(p.normalize("1a/filea"));

        g.checkout("master");
        testUtil.expectFile("1a/filea", "somethingelse");
      });

      it("should not meddle with index on second checkout", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add(p.normalize("1a/filea"));
        g.commit({ m: "first" });
        fs.writeFileSync("1a/filea", "somethingelse");

        testUtil.expectFile(".gitlet/index", p.normalize("1a/filea") + " 0 5ceba65\n");
        g.add(p.normalize("1a/filea"));

        g.checkout("master");
        testUtil.expectFile(".gitlet/index", p.normalize("1a/filea") + " 0 17b748b3\n");
      });

      it("should not meddle with HEAD commit on second checkout", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add(p.normalize("1a/filea"));
        g.commit({ m: "first" });

        testUtil.expectFile(".gitlet/refs/heads/master", "17a11ad4");
        g.checkout("master");
        testUtil.expectFile(".gitlet/refs/heads/master", "17a11ad4");
      });
    });

    describe("branch", function() {
      it("should say already on commit if try to check out current commit", function() {
        testUtil.createStandardFileStructure();
        g.init();

        g.add(p.normalize("1a/filea"));
        g.commit({ m: "first" });

        g.checkout("17a11ad4");
        expect(g.checkout("17a11ad4")).toEqual("Already on 17a11ad4");
      });

      it("should not meddle with wc on second checkout", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add(p.normalize("1a/filea"));
        g.commit({ m: "first" });

        g.checkout("17a11ad4");
        fs.writeFileSync("1a/filea", "somethingelse");
        g.add(p.normalize("1a/filea"));

        g.checkout("17a11ad4");
        testUtil.expectFile("1a/filea", "somethingelse");
      });

      it("should not meddle with index on second checkout", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add(p.normalize("1a/filea"));
        g.commit({ m: "first" });
        g.checkout("17a11ad4");

        fs.writeFileSync("1a/filea", "somethingelse");

        testUtil.expectFile(".gitlet/index", p.normalize("1a/filea") + " 0 5ceba65\n");
        g.add(p.normalize("1a/filea"));

        g.checkout("17a11ad4");
        testUtil.expectFile(".gitlet/index", p.normalize("1a/filea") + " 0 17b748b3\n");
      });

      it("should not meddle with HEAD commit on second checkout", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add(p.normalize("1a/filea"));
        g.commit({ m: "first" });
        g.checkout("17a11ad4");

        testUtil.expectFile(".gitlet/refs/heads/master", "17a11ad4");
        g.checkout("17a11ad4");
        testUtil.expectFile(".gitlet/refs/heads/master", "17a11ad4");
      });
    });
  });
});
