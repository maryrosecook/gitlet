// var fs = require('fs');
// var ga = require('../src/gitlet-api');
// var testUtil = require('./test-util');

// function createStandardFileStructure() {
//   testUtil.createFilesFromTree({ "1a": { filea: "filea" },
//                                  "1b": { fileb: "fileb",
//                                          "2a": { filec: "filec" },
//                                          "2b": { filed: "filed",
//                                                  "3a": { filee: "filee" }}}});
// };

// describe('checkout', function() {
//   beforeEach(testUtil.createEmptyRepo);

  // it('should throw if not in repo', function() {
  //   expect(function() { ga.checkout(); })
  //     .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  // });

  // it('should throw if pass ref that does not resolve to a hash', function() {
  //   ga.init();
  //   expect(function() { ga.checkout("woo"); })
  //     .toThrow("error: pathspec woo did not match any file(s) known to git.");
  // });

  // it('should throw if passed ref points to a blob', function() {
  //   ga.init();
  //   createStandardFileStructure();

  //   ga.add("1a/filea");
  //   ga.commit({ m: "first" });
  //   expect(function() { ga.checkout("5ceba65") })
  //     .toThrow("fatal: reference is not a tree: 5ceba65")
  // });

  // it('should throw if file has changes w/o common orig content with c/o branch', function() {
  //   ga.init();
  //   createStandardFileStructure();

  //   ga.add("1a/filea");
  //   ga.commit({ m: "first" });

  //   ga.branch("other");

  //   fs.writeFileSync("1a/filea", "fileachange1");
  //   ga.add("1a/filea");
  //   ga.commit({ m: "second" });

  //   fs.writeFileSync("1a/filea", "fileachange2");

  //   expect(function() { ga.checkout("other"); })
  //     .toThrow("error: Aborting. Your local changes to these files would be overwritten:\n" +
	//              "1a/filea\n");
  // });

  // it('should remove commited files in previous working copy', function() {
  //   ga.init();
  //   createStandardFileStructure();

  //   ga.add("1a/filea");
  //   ga.commit({ m: "first" });
  //   ga.branch("other");

  //   ga.add("1b/fileb");
  //   ga.commit({ m: "second" });

  //   ga.checkout("other");
  //   expect(fs.existsSync("1b/fileb")).toEqual(false);
  // });

  // it('should allow a tree hash to be passed', function() {

  // });

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

// });
