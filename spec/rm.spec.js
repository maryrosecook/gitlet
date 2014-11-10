var fs = require("fs");
var g = require("../src/gitlet");
var nodePath = require("path");
var testUtil = require("./test-util");

describe("rm", function() {
  beforeEach(testUtil.initTestDataDir);

  it("should throw if not in repo", function() {
    expect(function() { g.rm(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  describe("pathspec matching", function() {
    it("should throw rel path if in root and pathspec does not match files", function() {
      g.init();
      expect(function() { g.rm("blah"); })
        .toThrow("fatal: pathspec 'blah' did not match any files");
    });

    it("should throw rel path if not in root and pathspec does not match files", function() {
      g.init();
      testUtil.createFilesFromTree({ "1": { "2": {}}})
      process.chdir("1/2");
      expect(function() { g.rm("blah"); })
        .toThrow("fatal: pathspec '1/2/blah' did not match any files");
    });
  });

  it("should throw pathspec error if file on disk but not in index", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea" });
    expect(fs.existsSync("filea")).toEqual(true); // sanity
    expect(testUtil.index().length).toEqual(0); // sanity

    expect(function() { g.rm("filea"); })
      .toThrow("fatal: pathspec 'filea' did not match any files");
  });

  it("should rm file from index/disk if file on disk + in idx + in head", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea" });
    g.add("filea", { add: true });
    g.commit({ m: "first" });

    g.rm("filea");
    expect(testUtil.index().length).toEqual(0);
    expect(fs.existsSync("filea")).toEqual(false);
  });

  it("should rm file from index if file not on disk + in index + in head", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea" });
    g.add("filea", { add: true });
    g.commit({ m: "first" });

    fs.unlinkSync("filea");
    expect(fs.existsSync("filea")).toEqual(false); // sanity

    g.rm("filea");
    expect(testUtil.index().length).toEqual(0);
    expect(fs.existsSync("filea")).toEqual(false);
  });

  it("should rm file from index if file not on disk + in index + not in head", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea" });
    g.add("filea", { add: true });

    fs.unlinkSync("filea");
    expect(fs.existsSync("filea")).toEqual(false); // sanity

    g.rm("filea");
    expect(testUtil.index().length).toEqual(0);
    expect(fs.existsSync("filea")).toEqual(false);
  });

  it("should throw unsupported if try to force rm", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea" });
    g.add("filea", { add: true });
    expect(function() { g.rm("filea", { f: true }); }).toThrow("unsupported");
  });

  it("should throw if new file added to index, then rmed", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea" });
    g.add("filea", { add: true });
    expect(function() { g.rm("filea"); })
      .toThrow("error: the following files have changes:\nfilea\n");
  });

  it("should throw if file modified, then rmed", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea" });
    g.add("filea", { add: true });
    g.commit({ m: "first" });

    fs.writeFileSync("filea", "fileaa");
    expect(function() { g.rm("filea"); })
      .toThrow("error: the following files have changes:\nfilea\n");
  });

  it("should allow removals to be committed", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb" });
    g.add("filea", { add: true });
    g.add("fileb", { add: true });
    g.commit({ m: "first" });

    g.rm("filea");
    g.commit({ m: "second" });
  });

  it("should allow removal of last file to be committed", function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea" });
    g.add("filea", { add: true });
    g.commit({ m: "first" });

    g.rm("filea");
    g.commit({ m: "second" });
    expect(testUtil.index().length).toEqual(0);
  });

  describe("recursive", function() {
    it("should throw pathspec error if try and rm dir w no indexed files", function() {
      g.init();
      expect(function() { g.rm("src") })
        .toThrow("fatal: pathspec 'src' did not match any files");
    });

    it("should mention staged and unstaged changes when rm multiple files", function() {
      g.init();
      testUtil.createFilesFromTree({ src: { filea: "filea", fileb: "fileb" } });

      g.add("src/filea", { add: true });
      g.add("src/fileb", { add: true });
      g.commit({ m: "first" });

      fs.writeFileSync("src/filea", "fileaa");
      fs.writeFileSync("src/fileb", "fileab");
      g.add("src/filea");

      expect(function() { g.rm("src", { r: true }); })
        .toThrow("error: the following files have changes:\nsrc/filea\nsrc/fileb\n");
    });

    it("should rm nested files", function() {
      g.init();
      testUtil.createFilesFromTree({ src1: { filea: "filea", src2: { fileb: "fileb" } }});

      g.add("src1", { add: true });
      g.commit({ m: "first" });

      g.rm("src1", { r: true });
      expect(testUtil.index().length).toEqual(0);
    });
  });
});
