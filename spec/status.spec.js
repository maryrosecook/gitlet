var fs = require("fs");
var nodePath = require("path");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

describe("status", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.push(); })
      .toThrow("not a Gitlet repository");
  });

  it("should say what current branch is", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1a/filea");
    g.commit({ m: "first" });
    g.branch("other");
    g.checkout("other");

    expect(g.status()).toMatch(/On branch other/);
  });

  it("should mention untracked files", function() {
    g.init();
    fs.writeFileSync("a");
    fs.writeFileSync("b");
    expect(g.status()).toMatch("Untracked files:\na\nb");
  });

  it("should mention unmerged files", function() {
    //           a b
    //            |
    //          aa bb
    //         /     \
    // M aaa bbb   aaaa bbbb
    //         \     /
    //       m    O

    g.init();
    testUtil.createDeeplyNestedFileStructure();

    g.add("filea");
    g.commit({ m: "a" });

    g.add("fileb");
    g.commit({ m: "b" });

    fs.writeFileSync("filea", "fileaa");
    g.add("filea");
    g.commit({ m: "aa" });

    fs.writeFileSync("fileb", "filebb");
    g.add("fileb");
    g.commit({ m: "bb" });

    g.branch("other");

    fs.writeFileSync("filea", "fileaaa");
    g.add("filea");
    g.commit({ m: "aaa" });

    fs.writeFileSync("fileb", "filebbb");
    g.add("fileb");
    g.commit({ m: "bbb" });

    g.checkout("other");

    fs.writeFileSync("filea", "fileaaaa");
    g.add("filea");
    g.commit({ m: "aaaa" });

    fs.writeFileSync("fileb", "filebbbb");
    g.add("fileb");
    g.commit({ m: "bbbb" });

    g.merge("master");

    expect(g.status())
      .toMatch("Unmerged paths:\n" +
               "filea\n" +
               "fileb\n");
  });
});
