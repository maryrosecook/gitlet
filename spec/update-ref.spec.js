var fs = require("fs");
var g = require("../src/gitlet");
var objects = require("../src/objects");
var config = require("../src/config");
var testUtil = require("./test-util");

describe("update-ref", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.update_ref(); })
      .toThrow("not a Gitlet repository");
  });

  it("should throw if try to update ref that is not in refs/heads/", function() {
    g.init();
    expect(function() { g.update_ref("/", ""); }).toThrow("cannot lock the ref /");
    expect(function() { g.update_ref("refs/", ""); })
      .toThrow("cannot lock the ref refs/");
    expect(function() { g.update_ref("refs/heads", ""); })
      .toThrow("cannot lock the ref refs/heads");
    expect(function() { g.update_ref("refs/heads/", ""); })
      .toThrow("cannot lock the ref refs/heads/");
    expect(function() { g.update_ref("../woo", ""); })
      .toThrow("cannot lock the ref ../woo");
  });

  it("should throw if ref2 is a hash that is not in the db", function() {
    g.init();
    expect(function() { g.update_ref("refs/heads/master", "123"); })
      .toThrow("123 not a valid SHA1");
  });

  it("should throw if try to update HEAD to hash that is not a commit", function() {
    g.init();
    fs.writeFileSync("a", "a");
    var hash = objects.write("a");
    expect(function() { g.update_ref("HEAD", hash); })
      .toThrow("refs/heads/master cannot refer to non-commit object " + hash + "\n");
  });

  it("should throw if try to update master to hash that is not a commit", function() {
    g.init();
    fs.writeFileSync("a", "a");
    var hash = objects.write("a");
    expect(function() { g.update_ref("refs/heads/master", hash); })
      .toThrow("refs/heads/master cannot refer to non-commit object " + hash + "\n");
  });

  it("should allow updating HEAD to hash", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1a");
    g.commit({ m: "first" });
    g.add("1b");
    g.commit({ m: "second" });

    expect(fs.readFileSync(".gitlet/HEAD", "utf8")).toEqual("ref: refs/heads/master\n");
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("5b228c59");

    g.update_ref("HEAD", "17a11ad4");

    expect(fs.readFileSync(".gitlet/HEAD", "utf8")).toEqual("ref: refs/heads/master\n");
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("17a11ad4");
  });

  it("should update terminal ref at HEAD to passed hash, not HEAD file content", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb" });

    g.add("filea");
    g.commit({ m: "first" });

    g.branch("other-branch");

    g.add("fileb");
    g.commit({ m: "second" });

    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("d08448d");
    g.update_ref("HEAD", "refs/heads/other-branch");
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("281d2f1c");
    expect(fs.readFileSync(".gitlet/HEAD", "utf8")).toEqual("ref: refs/heads/master\n");
  });

  it("should allow update of master to a hash", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1a");
    g.commit({ m: "first" });
    g.add("1b");
    g.commit({ m: "second" });

    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("5b228c59");
    g.update_ref("refs/heads/master", "17a11ad4");
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("17a11ad4");
  });

  it("should allow master to be updated to a qualified branch", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb" });

    g.add("filea");
    g.commit({ m: "first" });

    g.branch("other-branch");

    g.add("fileb");
    g.commit({ m: "second" });

    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("d08448d");
    g.update_ref("refs/heads/master", "refs/heads/other-branch");
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("281d2f1c");
  });

  it("should allow master to be updated to an unqualified branch", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb" });

    g.add("filea");
    g.commit({ m: "first" });

    g.branch("other-branch");

    g.add("fileb");
    g.commit({ m: "second" });

    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("d08448d");
    g.update_ref("refs/heads/master", "other-branch");
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("281d2f1c");
  });

  it("should allow ref to be updated to HEAD", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb" });

    g.add("filea");
    g.commit({ m: "first" });

    g.branch("other-branch");

    g.add("fileb");
    g.commit({ m: "second" });

    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("d08448d");
    expect(fs.readFileSync(".gitlet/refs/heads/other-branch", "utf8")).toEqual("281d2f1c");
    g.update_ref("refs/heads/other-branch", "HEAD");
    expect(fs.readFileSync(".gitlet/refs/heads/other-branch", "utf8")).toEqual("d08448d");
  });

  it("should be allowed to update ref on bare repo", function() {
    var gl = g, gb = g;

    gl.init();
    testUtil.createStandardFileStructure();
    gl.add("1a");
    gl.commit({ m: "first" });
    gl.add("1b");
    gl.commit({ m: "second" });

    process.chdir("../");
    g.clone("repo1", "repo2", { bare: true });

    process.chdir("repo2");
    expect(config.readIsBare()).toEqual(true);

    expect(fs.readFileSync("refs/heads/master", "utf8")).toEqual("5b228c59");
    g.update_ref("refs/heads/master", "17a11ad4");
    expect(fs.readFileSync("refs/heads/master", "utf8")).toEqual("17a11ad4");
  });
});
