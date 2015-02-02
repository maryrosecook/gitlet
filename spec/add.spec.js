var fs = require("fs");
var p = require('path');
var g = require("../gitlet");
var testUtil = require("./test-util");

describe("add", function() {
  beforeEach(testUtil.initTestDataDir);

  it("should throw if not in repo", function() {
    expect(function() { g.add(); })
      .toThrow("not a Gitlet repository");
  });

  it("should throw if in bare repo", function() {
    g.init({ bare: true });
    expect(function() { g.add(); })
      .toThrow("this operation must be run in a work tree");
  });

  describe("pathspec matching", function() {
    it("should throw rel path if in root and pathspec does not match files", function() {
      g.init();
      expect(function() { g.add("blah"); })
        .toThrow("blah did not match any files");
    });

    it("should throw rel path if not in root and pathspec does not match files", function() {
      g.init();
      testUtil.createFilesFromTree({ "1": { "2": {}}})
      process.chdir("1/2");
      expect(function() { g.add("blah"); })
        .toThrow(p.normalize("1/2/blah") + " did not match any files");
    });
  });

  describe("adding files", function() {
    it("should be able to add single file in sub dir", function() {
      // regression test
      g.init();
      testUtil.createFilesFromTree({ "1": { "filea": "filea" }});
      g.add(p.normalize("1/filea"));
      expect(testUtil.index()[0].path).toEqual(p.normalize("1/filea"));
      expect(testUtil.index().length).toEqual(1);
    });

    it("should add all files in a large dir tree", function() {
      g.init();
      testUtil.createStandardFileStructure();
      g.add("1b");
      expect(testUtil.index()[0].path).toEqual(p.normalize("1b/2b/3b/4b/filed"));
      expect(testUtil.index()[1].path).toEqual(p.normalize("1b/2b/filec"));
      expect(testUtil.index()[2].path).toEqual(p.normalize("1b/fileb"));
      expect(testUtil.index().length).toEqual(3);
    });

    it("should add only files in specified subdir", function() {
      g.init();
      testUtil.createStandardFileStructure();
      g.add("1b");
      expect(testUtil.index()[0].path).toEqual(p.normalize("1b/2b/3b/4b/filed"));
      expect(testUtil.index()[1].path).toEqual(p.normalize("1b/2b/filec"));
      expect(testUtil.index()[2].path).toEqual(p.normalize("1b/fileb"));
      expect(testUtil.index().length).toEqual(3);
    });

    it("should be able to add multiple sets of files", function() {
      g.init();
      testUtil.createStandardFileStructure();

      g.add(p.normalize("1b/2b"));
      expect(testUtil.index()[0].path).toEqual(p.normalize("1b/2b/3b/4b/filed"));
      expect(testUtil.index()[1].path).toEqual(p.normalize("1b/2b/filec"));
      expect(testUtil.index().length).toEqual(2);

      g.add("1a");
      expect(testUtil.index()[2].path).toEqual(p.normalize("1a/filea"));
      expect(testUtil.index().length).toEqual(3);
    });

    it("should complain that file does not exist even if in index", function() {
      // git 1.8.2.3 does not complain that file does not exist,
      // presumably because it is in the index.  git 2.0 will complain.

      testUtil.createStandardFileStructure();
      g.init();
      g.add(p.normalize("1a/filea"));
      fs.unlinkSync("1a/filea");
      expect(function() { g.add(p.normalize("1a/filea")); })
        .toThrow(p.normalize("1a/filea") + " did not match any files");
    });
  });
});
