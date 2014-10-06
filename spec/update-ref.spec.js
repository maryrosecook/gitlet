var fs = require("fs");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

describe("update-ref", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.update_ref(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it("should throw if try to update ref that is not in refs/heads/", function() {
    g.init();
    expect(function() { g.update_ref("/", ""); }).toThrow("fatal: Cannot lock the ref /.");
    expect(function() { g.update_ref("refs/", ""); })
      .toThrow("fatal: Cannot lock the ref refs/.");
    expect(function() { g.update_ref("refs/heads", ""); })
      .toThrow("fatal: Cannot lock the ref refs/heads.");
    expect(function() { g.update_ref("refs/heads/", ""); })
      .toThrow("fatal: Cannot lock the ref refs/heads/.");
    expect(function() { g.update_ref("../woo", ""); })
      .toThrow("fatal: Cannot lock the ref ../woo.");
  });

  it("should throw if ref2 is a hash that is not in the db", function() {
    g.init();
    expect(function() { g.update_ref("refs/heads/master", "123"); })
      .toThrow("fatal: 123: not a valid SHA1");
  });

  it("should throw if try to update HEAD to hash that is not a commit", function() {
    g.init();
    fs.writeFileSync("a", "a");
    var hash = g.hash_object("a", { w: true });
    expect(function() { g.update_ref("HEAD", hash); })
      .toThrow("error: Trying to write non-commit object " + hash +
               " to branch refs/heads/master\n");
  });

  it("should throw if try to update master to hash that is not a commit", function() {
    g.init();
    fs.writeFileSync("a", "a");
    var hash = g.hash_object("a", { w: true });
    expect(function() { g.update_ref("refs/heads/master", hash); })
      .toThrow("error: Trying to write non-commit object " + hash +
               " to branch refs/heads/master\n");
  });

  it("should allow updating HEAD to hash", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1a");
    g.commit({ m: "first" });
    g.add("1b");
    g.commit({ m: "second" });

    expect(fs.readFileSync(".gitlet/HEAD", "utf8")).toEqual("ref: refs/heads/master\n");
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("59bb8412");

    g.update_ref("HEAD", "21cb63f6");

    expect(fs.readFileSync(".gitlet/HEAD", "utf8")).toEqual("ref: refs/heads/master\n");
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("21cb63f6");
  });

  it("should update terminal ref at HEAD to passed hash, not HEAD file content", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb" });

    g.add("filea");
    g.commit({ m: "first" });

    g.branch("other-branch");

    g.add("fileb");
    g.commit({ m: "second" });

    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("67fd42fe");
    g.update_ref("HEAD", "refs/heads/other-branch");
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("98d541a");
    expect(fs.readFileSync(".gitlet/HEAD", "utf8")).toEqual("ref: refs/heads/master\n");
  });

  it("should allow update of master to a hash", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1a");
    g.commit({ m: "first" });
    g.add("1b");
    g.commit({ m: "second" });

    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("59bb8412");
    g.update_ref("refs/heads/master", "21cb63f6");
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("21cb63f6");
  });

  it("should allow master to be updated to a qualified branch", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb" });

    g.add("filea");
    g.commit({ m: "first" });

    g.branch("other-branch");

    g.add("fileb");
    g.commit({ m: "second" });

    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("67fd42fe");
    g.update_ref("refs/heads/master", "refs/heads/other-branch");
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("98d541a");
  });

  it("should allow master to be updated to an unqualified branch", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb" });

    g.add("filea");
    g.commit({ m: "first" });

    g.branch("other-branch");

    g.add("fileb");
    g.commit({ m: "second" });

    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("67fd42fe");
    g.update_ref("refs/heads/master", "other-branch");
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("98d541a");
  });

  it("should allow ref to be updated to HEAD", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb" });

    g.add("filea");
    g.commit({ m: "first" });

    g.branch("other-branch");

    g.add("fileb");
    g.commit({ m: "second" });

    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("67fd42fe");
    expect(fs.readFileSync(".gitlet/refs/heads/other-branch", "utf8")).toEqual("98d541a");
    g.update_ref("refs/heads/other-branch", "HEAD");
    expect(fs.readFileSync(".gitlet/refs/heads/other-branch", "utf8")).toEqual("67fd42fe");
  });
});
