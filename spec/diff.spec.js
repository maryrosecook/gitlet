var fs = require("fs");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

describe("diff", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.diff(); })
      .toThrow("not a Gitlet repository");
  });

  it("should throw if in bare repo", function() {
    g.init({ bare: true });
    expect(function() { g.diff(); })
      .toThrow("this operation must be run in a work tree");
  });

  it("should throw if do not pass --name-status option", function() {
    g.init();
    expect(function() { g.diff(undefined, undefined, {}); }).toThrow("unsupported");
  });

  it("should throw unknown revision if ref1 not in objects", function() {
    g.init();
    expect(function() { g.diff("blah1", undefined, { "name-status": true }) })
      .toThrow("ambiguous argument blah1: unknown revision");
  });

  it("should throw unknown revision if ref2 not in objects", function() {
    g.init();
    expect(function() { g.diff("blah2", undefined, { "name-status": true }) })
      .toThrow("ambiguous argument blah2: unknown revision");
  });

  it("should include several files with changes", function() {
    testUtil.createStandardFileStructure();
    g.init();
    g.add("1a/filea");
    g.add("1b/fileb");
    g.add("1b/2b/filec");
    g.commit({ m: "first" });
    fs.writeFileSync("1a/filea", "somethingelsea");
    fs.writeFileSync("1b/fileb", "somethingelseb");
    fs.writeFileSync("1b/2b/filec", "somethingelsec");
    expect(g.diff(undefined, undefined, { "name-status": true }))
      .toEqual("M 1a/filea\nM 1b/fileb\nM 1b/2b/filec\n");
  });

  describe("no refs passed (index and WC)", function() {
    it("should show nothing for repo w no commits", function() {
      g.init();
      expect(g.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it("should not include unstaged files", function() {
      // this is because the file is never mentioned by the index,
      // which is to say: it doesn't compare absence against the WC hash.

      testUtil.createStandardFileStructure();
      g.init();
      expect(g.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it("should not include new file that is staged", function() {
      // this is because the file is in the index, but the version
      // in the WC is the same

      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      expect(testUtil.index()[0].path).toEqual("1a/filea");
      expect(g.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it("should not include committed file w no changes", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      expect(g.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it("should include committed file w unstaged changes", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      fs.writeFileSync("1a/filea", "somethingelse");
      expect(g.diff(undefined, undefined, { "name-status": true }))
        .toEqual("M 1a/filea\n");
    });

    it("should not include committed file w staged changes", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      fs.writeFileSync("1a/filea", "somethingelse");
      g.add("1a/filea");
      expect(g.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it("should say file that was created, staged, deleted was deleted", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      fs.unlinkSync("1a/filea");
      expect(g.diff(undefined, undefined, { "name-status": true }))
        .toEqual("D 1a/filea\n");
    });

    it("should not include file that was created, deleted but never staged", function() {
      testUtil.createStandardFileStructure();
      g.init();
      fs.unlinkSync("1a/filea");
      expect(g.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it("should say committed file that has now been deleted has been deleted", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      fs.unlinkSync("1a/filea");
      expect(g.diff(undefined, undefined, { "name-status": true })).toEqual("D 1a/filea\n");
    });
  });

  describe("one ref passed (someref and WC)", function() {
    describe("HEAD passed (compared with WC)", function() {
      it("should blow up for HEAD if no commits", function() {
        g.init();
        expect(function() { g.diff("HEAD", undefined, { "name-status": true }) })
          .toThrow("ambiguous argument HEAD: unknown revision");
      });

      it("should not include unstaged files", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        expect(g.diff("HEAD", undefined, { "name-status": true })).toEqual("\n");
      });

      it("should include new file that is staged", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        g.add("1b/fileb");
        expect(g.diff("HEAD", undefined, { "name-status": true })).toEqual("A 1b/fileb\n");
      });

      it("should not include committed file w no changes", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        expect(g.diff("HEAD", undefined, { "name-status": true })).toEqual("\n");
      });

      it("should include committed file w unstaged changes", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        fs.writeFileSync("1a/filea", "somethingelse");
        expect(g.diff("HEAD", undefined, { "name-status": true })).toEqual("M 1a/filea\n");
      });

      it("should include committed file w staged changes", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        fs.writeFileSync("1a/filea", "somethingelse");
        g.add("1a/filea");
        expect(g.diff("HEAD", undefined, { "name-status": true })).toEqual("M 1a/filea\n");
      });

      it("should not include file that was created, staged, deleted", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        g.add("1b/fileb");
        fs.unlinkSync("1b/fileb");
        expect(g.diff("HEAD", undefined, { "name-status": true })).toEqual("\n");
      });

      it("should not include file that was created, deleted but never staged", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        fs.unlinkSync("1b/fileb");
        expect(g.diff("HEAD", undefined, { "name-status": true })).toEqual("\n");
      });

      it("should say committed file that has now been deleted has been deleted", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        fs.unlinkSync("1a/filea");
        expect(g.diff("HEAD", undefined, { "name-status": true })).toEqual("D 1a/filea\n");
      });
    });

    describe("non-head commits passed (compared with WC)", function() {
      it("should include committed file modified in WC if HEAD hash passed", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        fs.writeFileSync("1a/filea", "somethingelse");
        expect(g.diff("17a11ad4", undefined, { "name-status": true }))
          .toEqual("M 1a/filea\n");
      });

      it("should incl committed file modified in WC if branch from head passed", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        g.branch("other");
        fs.writeFileSync("1a/filea", "somethingelse");
        expect(g.diff("other", undefined, { "name-status": true })).toEqual("M 1a/filea\n");
      });

      it("should blow up if non existent ref passed", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        expect(function() { g.diff("blah", undefined, { "name-status": true }) })
          .toThrow("ambiguous argument blah: unknown revision");
      });
    });
  });

  describe("two refs passed", function() {
    describe("basic changes", function() {
      it("should blow up with two refs if no commits", function() {
        g.init();
        expect(function() { g.diff("a", "b", { "name-status": true }) })
          .toThrow("ambiguous argument a: unknown revision");
      });

      it("should blow up for HEAD and other ref if no commits", function() {
        g.init();
        expect(function() { g.diff("HEAD", "b", { "name-status": true }) })
          .toThrow("ambiguous argument HEAD: unknown revision");
      });

      it("should blow up if either ref does not exist", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        expect(function() { g.diff("blah1", "blah2", { "name-status": true }) })
          .toThrow("ambiguous argument blah1: unknown revision");

        expect(function() { g.diff("HEAD", "blah2", { "name-status": true }) })
          .toThrow("ambiguous argument blah2: unknown revision");
      });

      it("should not include unstaged files", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        g.branch("a");
        g.branch("b");
        expect(g.diff("a", "b", { "name-status": true })).toEqual("\n");
      });

      it("should not include committed file w no changes", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        g.branch("a");
        g.branch("b");
        expect(g.diff("a", "b", { "name-status": true })).toEqual("\n");
      });

      it("should include added file", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        g.branch("a");
        g.add("1b/fileb");
        g.commit({ m: "second" });
        g.branch("b");
        expect(g.diff("a", "b", { "name-status": true })).toEqual("A 1b/fileb\n");
      });

      it("should include changed file", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        g.branch("a");
        fs.writeFileSync("1a/filea", "somethingelse");
        g.add("1a/filea");
        g.commit({ m: "second" });
        g.branch("b");
        expect(g.diff("a", "b", { "name-status": true })).toEqual("M 1a/filea\n");
      });

      it("should not include staged changes", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        g.branch("a");
        g.branch("b");
        g.add("1b/fileb");
        expect(g.diff("a", "b", { "name-status": true })).toEqual("\n");
      });
    });

    describe("reversing order of ref args", function() {
      it("should see deletion as addition and vice versa", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        g.branch("a");
        g.add("1b/fileb");
        g.commit({ m: "second" });
        g.branch("b");

        expect(g.diff("a", "b", { "name-status": true })).toEqual("A 1b/fileb\n");
        expect(g.diff("b", "a", { "name-status": true })).toEqual("D 1b/fileb\n");
      });

      it("should see modification in both directions", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        g.branch("a");
        fs.writeFileSync("1a/filea", "somethingelse");
        g.add("1a/filea");
        g.commit({ m: "second" });
        g.branch("b");

        expect(g.diff("a", "b", { "name-status": true })).toEqual("M 1a/filea\n");
        expect(g.diff("b", "a", { "name-status": true })).toEqual("M 1a/filea\n");
      });
    });

    describe("diffing commits with intervening commits where a lot happened", function() {
      it("should see additions", function() {
        testUtil.createStandardFileStructure();
        g.init();

        g.add("1a/filea");
        g.commit({ m: "first" });
        g.branch("a");

        g.add("1b/fileb");
        g.commit({ m: "second" });

        g.add("1b/2b/filec");
        g.commit({ m: "third" });

        g.add("1b/2b/3b/4b/filed");
        g.commit({ m: "fourth" });
        g.branch("b");

        expect(g.diff("a", "b", { "name-status": true }))
          .toEqual("A 1b/fileb\nA 1b/2b/filec\nA 1b/2b/3b/4b/filed\n");
      });

      it("should see deletions", function() {
        testUtil.createStandardFileStructure();
        g.init();

        g.add("1a/filea");
        g.commit({ m: "first" });
        g.branch("a");

        g.add("1b/fileb");
        g.commit({ m: "second" });

        g.add("1b/2b/filec");
        g.commit({ m: "third" });

        g.add("1b/2b/3b/4b/filed");
        g.commit({ m: "fourth" });
        g.branch("b");

        expect(g.diff("b", "a", { "name-status": true }))
          .toEqual("D 1b/fileb\nD 1b/2b/filec\nD 1b/2b/3b/4b/filed\n");
      });

      it("should see modifications", function() {
        testUtil.createStandardFileStructure();
        g.init();

        g.add("1a/filea");
        g.add("1b/fileb");
        g.add("1b/2b/filec");
        g.commit({ m: "first" });
        g.branch("a");

        fs.writeFileSync("1a/filea", "somethingelse");
        g.add("1a/filea");
        g.commit({ m: "second" });

        fs.writeFileSync("1b/fileb", "somethingelse");
        g.add("1b/fileb");
        g.commit({ m: "third" });

        fs.writeFileSync("1b/2b/filec", "somethingelse");
        g.add("1b/2b/filec");
        g.commit({ m: "fourth" });
        g.branch("b");

        expect(g.diff("a", "b", { "name-status": true }))
          .toEqual("M 1a/filea\nM 1b/fileb\nM 1b/2b/filec\n");
      });
    });

    describe("diffs in which several different types of thing happened", function() {
      it("should record additions and modifications", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        g.branch("a");

        g.add("1b/fileb");
        fs.writeFileSync("1a/filea", "somethingelse");
        g.add("1a/filea");
        g.commit({ m: "second" });
        g.branch("b");

        expect(g.diff("a", "b", { "name-status": true })).toEqual("M 1a/filea\nA 1b/fileb\n");
      });

      it("should record deletions and modifications", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        g.branch("a");

        g.add("1b/fileb");
        fs.writeFileSync("1a/filea", "somethingelse");
        g.add("1a/filea");
        g.commit({ m: "second" });
        g.branch("b");

        expect(g.diff("b", "a", { "name-status": true })).toEqual("M 1a/filea\nD 1b/fileb\n");
      });
    });
  });
});
