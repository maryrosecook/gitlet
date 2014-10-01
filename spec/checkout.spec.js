var fs = require('fs');
var ga = require('../src/gitlet-api');
var testUtil = require('./test-util');

describe('checkout', function() {
  beforeEach(testUtil.createEmptyRepo);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it('should throw if not in repo', function() {
    expect(function() { ga.checkout(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it('should throw if pass ref that does not resolve to a hash', function() {
    ga.init();
    expect(function() { ga.checkout("woo"); })
      .toThrow("error: pathspec woo did not match any file(s) known to gitlet.");
  });

  it('should throw if passed ref points to blob', function() {
    testUtil.createStandardFileStructure();
    ga.init();
    ga.add("1a/filea");
    ga.commit({ m: "first" });
    expect(function() { ga.checkout("5ceba65") })
      .toThrow("fatal: reference is not a tree: 5ceba65")
  });

  it('should throw if passed ref points to tree', function() {
    testUtil.createStandardFileStructure();
    ga.init();
    ga.add("1a/filea");
    ga.commit({ m: "first" });
    expect(function() { ga.checkout("17653b6d") })
      .toThrow("fatal: reference is not a tree: 17653b6d")
  });

  it('should throw if file has changes w/o common orig content with c/o branch', function() {
    testUtil.createStandardFileStructure();
    ga.init();

    ga.add("1a/filea");
    ga.commit({ m: "first" });

    ga.branch("other");

    fs.writeFileSync("1a/filea", "fileachange1");
    ga.add("1a/filea");
    ga.commit({ m: "second" });

    fs.writeFileSync("1a/filea", "fileachange2");

    expect(function() { ga.checkout("other"); })
      .toThrow("error: Aborting. Your local changes to these files would be overwritten:\n" +
	             "1a/filea\n");
  });

  it('should list all files that would be overwritten when throwing', function() {
    testUtil.createStandardFileStructure();
    ga.init();

    ga.add("1a/filea");
    ga.add("1b/fileb");
    ga.add("1b/2a/filec");
    ga.commit({ m: "first" });

    ga.branch("other");

    fs.writeFileSync("1a/filea", "fileachange1");
    fs.writeFileSync("1b/fileb", "fileachange1");
    fs.writeFileSync("1b/2a/filec", "fileachange1");
    ga.add("1a/filea");
    ga.add("1b/fileb");
    ga.add("1b/2a/filec");
    ga.commit({ m: "second" });

    fs.writeFileSync("1a/filea", "fileachange2");
    fs.writeFileSync("1b/fileb", "fileachange2");
    fs.writeFileSync("1b/2a/filec", "fileachange2");

    expect(function() { ga.checkout("other"); })
      .toThrow("error: Aborting. Your local changes to these files would be overwritten:\n" +
	             "1a/filea\n1b/fileb\n1b/2a/filec\n");
  });

  it('should not throw if file has changes w/ common orig content w/ c/o branch', function() {
    testUtil.createStandardFileStructure();
    ga.init();

    ga.add("1a/filea");
    ga.commit({ m: "first" });

    ga.branch("other");
    fs.writeFileSync("1a/filea", "fileachange2");

    ga.checkout("other"); // does not throw
  });

  it('should keep uncommitted changes compatible w checked out branch', function() {
    testUtil.createStandardFileStructure();
    ga.init();

    ga.add("1a/filea");
    ga.commit({ m: "first" });

    ga.branch("other");
    fs.writeFileSync("1a/filea", "fileachange2");

    ga.checkout("other");
    testUtil.expectFile("1a/filea", "fileachange2");
  });

  describe('successful checkout', function() {
    it('should remove committed files in previous working copy', function() {
      testUtil.createStandardFileStructure();
      ga.init();

      ga.add("1a/filea");
      ga.commit({ m: "first" });
      ga.branch("other");

      ga.add("1b/fileb");
      ga.commit({ m: "second" });

      ga.checkout("other");
      expect(fs.existsSync("1b/fileb")).toEqual(false);
    });

    it('should add committed files in checked out ref', function() {
      testUtil.createStandardFileStructure();
      ga.init();

      ga.add("1a/filea");
      ga.commit({ m: "first" });
      ga.branch("other");

      ga.add("1b/fileb");
      ga.commit({ m: "second" });

      ga.checkout("other");
      expect(fs.existsSync("1b/fileb")).toEqual(false); // sanity check

      ga.checkout("master");
      expect(fs.existsSync("1b/fileb")).toEqual(true); // sanity check
    });

    it('should remove empty folders after checkout', function() {
      testUtil.createStandardFileStructure();
      ga.init();

      ga.add("1a/filea");
      ga.commit({ m: "first" });
      ga.branch("other");

      ga.add("1b/2b/3b/4b/5b/filef");
      ga.commit({ m: "second" });

      ga.checkout("other");
      expect(fs.existsSync("1b/2b/3b")).toEqual(false);
    });

    it('should not remove folders that have unindexed files', function() {
      testUtil.createStandardFileStructure();
      ga.init();

      ga.add("1a/filea");
      ga.commit({ m: "first" });
      ga.branch("other");

      ga.add("1b/2b/3b/4b/5b/filef");
      ga.commit({ m: "second" });

      ga.checkout("other");
      expect(fs.existsSync("1b/2b/3a/filee")).toEqual(true);
    });
  });


  // it('should allow a commit hash to be passed', function() {

  // });


  // it('should point head at passed ref', function() {

  // });

  // it('should point head at passed commit hash', function() {

  // });

  // it('should warn that leaving detached head behind if checkout from det head', function() {

  // });

  // it('should abort on staged changed file w dif content from checkout(ref)', function() {

  // });

  // it('should abort on unstaged changed file w dif content from checkout(ref)', function() {

  // });

  // it('should checkout from both tree ref and commit ref', function() {

  // });

  // it('should remove old dirs', function() {

  // });

});
