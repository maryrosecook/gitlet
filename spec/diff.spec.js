var fs = require('fs');
var ga = require('../gimlet-api');
var testUtil = require('./test-util');

describe('diff', function() {
  beforeEach(testUtil.createEmptyRepo);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it('should throw if not in repo', function() {
    expect(function() { ga.diff(); })
      .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
  });

  it('should throw if do not pass --name-status option', function() {
    ga.init();
    expect(function() { ga.diff(undefined, undefined, {}); }).toThrow("unsupported");
  });

  it('should throw unknown revision if ref1 not in objects', function() {
    ga.init();
    expect(function() { ga.diff("blah1", undefined, { "name-status": true }) })
      .toThrow("fatal: ambiguous argument blah1: unknown revision");
  });

  it('should throw unknown revision if ref2 not in objects', function() {
    ga.init();
    expect(function() { ga.diff("blah2", undefined, { "name-status": true }) })
      .toThrow("fatal: ambiguous argument blah2: unknown revision");
  });

  it('should include several files with changes', function() {
    testUtil.createStandardFileStructure();
    ga.init();
    ga.add("1a/filea");
    ga.add("1b/fileb");
    ga.add("1b/2a/filec");
    ga.commit({ m: "first" });
    fs.writeFileSync("1a/filea", "somethingelsea");
    fs.writeFileSync("1b/fileb", "somethingelseb");
    fs.writeFileSync("1b/2a/filec", "somethingelsec");
    expect(ga.diff(undefined, undefined, { "name-status": true }))
      .toEqual("M 1a/filea\nM 1b/fileb\nM 1b/2a/filec\n");
  });

  describe('no refs passed (index and WC)', function() {
    it('should show nothing for repo w no commits', function() {
      ga.init();
      expect(ga.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it('should not include unstaged files', function() {
      // this is because the file is never mentioned by the index,
      // which is to say: it doesn't compare absence against the WC hash.

      testUtil.createStandardFileStructure();
      ga.init();
      expect(ga.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it('should not include new file that is staged', function() {
      // this is because the file is in the index, but the version
      // in the WC is the same

      testUtil.createStandardFileStructure();
      ga.init();
      ga.add("1a/filea");
      expect(testUtil.index()[0].path).toEqual("1a/filea");
      expect(ga.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it('should not include committed file w no changes', function() {
      testUtil.createStandardFileStructure();
      ga.init();
      ga.add("1a/filea");
      ga.commit({ m: "first" });
      expect(ga.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it('should include committed file w unstaged changes', function() {
      testUtil.createStandardFileStructure();
      ga.init();
      ga.add("1a/filea");
      ga.commit({ m: "first" });
      fs.writeFileSync("1a/filea", "somethingelse");
      expect(ga.diff(undefined, undefined, { "name-status": true }))
        .toEqual("M 1a/filea\n");
    });

    it('should not include committed file w staged changes', function() {
      testUtil.createStandardFileStructure();
      ga.init();
      ga.add("1a/filea");
      ga.commit({ m: "first" });
      fs.writeFileSync("1a/filea", "somethingelse");
      ga.add("1a/filea");
      expect(ga.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it('should say file that was created, staged, deleted was deleted', function() {
      testUtil.createStandardFileStructure();
      ga.init();
      ga.add("1a/filea");
      fs.unlink("1a/filea");
      expect(ga.diff(undefined, undefined, { "name-status": true }))
        .toEqual("D 1a/filea\n");
    });

    it('should not include file that was created, deleted but never staged', function() {
      testUtil.createStandardFileStructure();
      ga.init();
      fs.unlink("1a/filea");
      expect(ga.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it('should say commited file that has now been deleted has been deleted', function() {
      testUtil.createStandardFileStructure();
      ga.init();
      ga.add("1a/filea");
      ga.commit({ m: "first" });
      fs.unlink("1a/filea");
      expect(ga.diff(undefined, undefined, { "name-status": true })).toEqual("D 1a/filea\n");
    });
  });

  describe('one ref passed (someref and WC)', function() {
    describe('HEAD passed (compared with WC)', function() {
      it('should blow up for HEAD if no commits', function() {
        ga.init();
        expect(function() { ga.diff("HEAD", undefined, { "name-status": true }) })
          .toThrow("fatal: ambiguous argument HEAD: unknown revision");
      });

      it('should not include unstaged files', function() {
        testUtil.createStandardFileStructure();
        ga.init();
        ga.add("1a/filea");
        ga.commit({ m: "first" });
        expect(ga.diff("HEAD", undefined, { "name-status": true })).toEqual("\n");
      });

      it('should include new file that is staged', function() {
        testUtil.createStandardFileStructure();
        ga.init();
        ga.add("1a/filea");
        ga.commit({ m: "first" });
        ga.add("1b/fileb");
        expect(ga.diff("HEAD", undefined, { "name-status": true })).toEqual("A 1b/fileb\n");
      });

      it('should not include committed file w no changes', function() {
        testUtil.createStandardFileStructure();
        ga.init();
        ga.add("1a/filea");
        ga.commit({ m: "first" });
        expect(ga.diff("HEAD", undefined, { "name-status": true })).toEqual("\n");
      });

      it('should include committed file w unstaged changes', function() {
        testUtil.createStandardFileStructure();
        ga.init();
        ga.add("1a/filea");
        ga.commit({ m: "first" });
        fs.writeFileSync("1a/filea", "somethingelse");
        expect(ga.diff("HEAD", undefined, { "name-status": true })).toEqual("M 1a/filea\n");
      });

      it('should include committed file w staged changes', function() {
        testUtil.createStandardFileStructure();
        ga.init();
        ga.add("1a/filea");
        ga.commit({ m: "first" });
        fs.writeFileSync("1a/filea", "somethingelse");
        ga.add("1a/filea");
        expect(ga.diff("HEAD", undefined, { "name-status": true })).toEqual("M 1a/filea\n");
      });

      it('should not include file that was created, staged, deleted', function() {
        testUtil.createStandardFileStructure();
        ga.init();
        ga.add("1a/filea");
        ga.commit({ m: "first" });
        ga.add("1b/fileb");
        fs.unlink("1b/fileb");
        expect(ga.diff("HEAD", undefined, { "name-status": true })).toEqual("\n");
      });

      it('should not include file that was created, deleted but never staged', function() {
        testUtil.createStandardFileStructure();
        ga.init();
        ga.add("1a/filea");
        ga.commit({ m: "first" });
        fs.unlink("1b/fileb");
        expect(ga.diff("HEAD", undefined, { "name-status": true })).toEqual("\n");
      });

      it('should say commited file that has now been deleted has been deleted', function() {
        testUtil.createStandardFileStructure();
        ga.init();
        ga.add("1a/filea");
        ga.commit({ m: "first" });
        fs.unlink("1a/filea");
        expect(ga.diff("HEAD", undefined, { "name-status": true })).toEqual("D 1a/filea\n");
      });
    });

    describe('non-head commits passed (compared with WC)', function() {
      it('should include committed file modified in WC if HEAD hash passed', function() {
        testUtil.createStandardFileStructure();
        ga.init();
        ga.add("1a/filea");
        ga.commit({ m: "first" });
        fs.writeFileSync("1a/filea", "somethingelse");
        expect(ga.diff("21cb63f6", undefined, { "name-status": true }))
          .toEqual("M 1a/filea\n");
      });

      it('should incl committed file modified in WC if branch from head passed', function() {
        testUtil.createStandardFileStructure();
        ga.init();
        ga.add("1a/filea");
        ga.commit({ m: "first" });
        ga.branch("other");
        fs.writeFileSync("1a/filea", "somethingelse");
        expect(ga.diff("other", undefined, { "name-status": true })).toEqual("M 1a/filea\n");
      });
    });
  });

  describe('two refs passed', function() {
    it('should blow up with two refs if no commits', function() {
      ga.init();
      expect(function() { ga.diff("a", "b", { "name-status": true }) })
        .toThrow("fatal: ambiguous argument a: unknown revision");
    });

    it('should blow up for HEAD and other ref if no commits', function() {
      ga.init();
      expect(function() { ga.diff("HEAD", "b", { "name-status": true }) })
        .toThrow("fatal: ambiguous argument HEAD: unknown revision");
    });
  });
});
