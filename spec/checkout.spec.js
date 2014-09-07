var fs = require('fs');
var ga = require('../gimlet-api');
var testUtil = require('./test-util');

function createStandardFileStructure() {
  testUtil.createFilesFromTree({ "1a": { filea: "filea" },
                                 "1b": { fileb: "fileb",
                                         "2a": { filec: "filec" },
                                         "2b": { filed: "filed",
                                                 "3a": { filee: "filee" }}}});
};

// describe('checkout', function() {
//   beforeEach(testUtil.createEmptyRepo);

//   it('should throw if not in repo', function() {
//     expect(function() { ga.checkout(); })
//       .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
//   });

//   it('should throw if pass ref that does not resolve to a hash', function() {
//     ga.init();
//     expect(function() { ga.checkout("woo"); })
//       .toThrow("error: pathspec woo did not match any file(s) known to git.");
//   });

//   it('should remove commited files in previous working copy', function() {
//     ga.init();
//     createStandardFileStructure();

//     ga.add("1a/filea");
//     ga.commit({ m: "first", date: new Date(1409404605356) });
//     ga.branch("other");

//     ga.add("1b/fileb");
//     ga.commit({ m: "second", date: new Date(1409404605356) });

//     ga.checkout("other");
//     // expect(fs.existsSync("1b/fileb")).toEqual(false);
//   });

//   iit('should throw if passed ref points to a blob', function() {
//     ga.init();
//     createStandardFileStructure();

//     ga.add("1a/filea");
//     ga.commit({ m: "first", date: new Date(1409404605356) });
//     expect(ga.checkout("5ceba65")).toThrow("")
//   });

//   it('should allow a tree hash to be passed', function() {

//   });

//   it('should allow a commit hash to be passed', function() {

//   });


//   it('should point head at passed ref', function() {

//   });

//   it('should point head at passed commit hash', function() {

//   });

//   it('should warn that leaving detached head behind if checkout from det head', function() {

//   });

// });
