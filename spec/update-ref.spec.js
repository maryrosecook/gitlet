var fs = require('fs');
var g = require('../gimlet-api');
var testUtil = require('./test-util');

describe('update-ref', function() {
  beforeEach(testUtil.createEmptyRepo);

  it('should throw if not in repo', function() {
    expect(function() { g.update_ref(); })
      .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
  });

  it('should throw if try to update ref that is not in refs/heads/', function() {
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

  it('should throw if ref2 is a hash that is not in the db', function() {
    g.init();
    expect(function() { g.update_ref("refs/heads/master", "123"); })
      .toThrow("fatal: 123: not a valid SHA1");
  });

  it('should throw if try to update HEAD to hash that is not a commit', function() {
    g.init();
    fs.writeFileSync("a", "a");
    var hash = g.hash_object("a", { w: true });
    expect(function() { g.update_ref("HEAD", hash); })
      .toThrow("error: Trying to write non-commit object " + hash +
               " to branch refs/heads/master\n" +
               "fatal: Cannot update the ref HEAD");
  });

  it('should throw if try to update master to hash that is not a commit', function() {
    g.init();
    fs.writeFileSync("a", "a");
    var hash = g.hash_object("a", { w: true });
    expect(function() { g.update_ref("refs/heads/master", hash); })
      .toThrow("error: Trying to write non-commit object " + hash +
               " to branch refs/heads/master\n" +
               "fatal: Cannot update the ref refs/heads/master");
  });

  it('should allow updating HEAD to hash', function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                          { "filec": "filec", "3a":
                                            { "filed": "filed", "filee": "filee"}, "3b":
                                            { "filef": "filef", "fileg": "fileg"}}}});

    g.add("1/2/3a");
    g.commit({ m: "first", date: new Date(1409404605356) });
    g.add("1/2/3b");
    g.commit({ m: "second", date: new Date(1409404605356) });

    expect(fs.readFileSync(".gimlet/HEAD", "utf8")).toEqual("ref: refs/heads/master\n");
    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("5e0b3550");

    g.update_ref("HEAD", "343b3d02");

    expect(fs.readFileSync(".gimlet/HEAD", "utf8")).toEqual("ref: refs/heads/master\n");
    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("343b3d02");
  });

  it('should update terminal ref at HEAD to passed hash, not HEAD file content', function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb" });

    g.add("filea");
    g.commit({ m: "first", date: new Date(1409404605356) });

    g.branch("other-branch");

    g.add("fileb");
    g.commit({ m: "second", date: new Date(1409404605356) });

    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("67fd42fe");
    g.update_ref("HEAD", "refs/heads/other-branch");
    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("98d541a");
    expect(fs.readFileSync(".gimlet/HEAD", "utf8")).toEqual("ref: refs/heads/master\n");
  });

  it('should allow update of master to a hash', function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                          { "filec": "filec", "3a":
                                            { "filed": "filed", "filee": "filee"}, "3b":
                                            { "filef": "filef", "fileg": "fileg"}}}});

    g.add("1/2/3a");
    g.commit({ m: "first", date: new Date(1409404605356) });
    g.add("1/2/3b");
    g.commit({ m: "second", date: new Date(1409404605356) });

    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("5e0b3550");
    g.update_ref("refs/heads/master", "343b3d02");
    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("343b3d02");
  });

  it('should allow master to be updated to a qualified branch', function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb" });

    g.add("filea");
    g.commit({ m: "first", date: new Date(1409404605356) });

    g.branch("other-branch");

    g.add("fileb");
    g.commit({ m: "second", date: new Date(1409404605356) });

    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("67fd42fe");
    g.update_ref("refs/heads/master", "refs/heads/other-branch");
    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("98d541a");
  });

  it('should allow master to be updated to an unqualified branch', function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb" });

    g.add("filea");
    g.commit({ m: "first", date: new Date(1409404605356) });

    g.branch("other-branch");

    g.add("fileb");
    g.commit({ m: "second", date: new Date(1409404605356) });

    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("67fd42fe");
    g.update_ref("refs/heads/master", "other-branch");
    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("98d541a");
  });

  it('should allow ref to be updated to HEAD', function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb" });

    g.add("filea");
    g.commit({ m: "first", date: new Date(1409404605356) });

    g.branch("other-branch");

    g.add("fileb");
    g.commit({ m: "second", date: new Date(1409404605356) });

    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("67fd42fe");
    expect(fs.readFileSync(".gimlet/refs/heads/other-branch", "utf8")).toEqual("98d541a");
    g.update_ref("refs/heads/other-branch", "HEAD");
    expect(fs.readFileSync(".gimlet/refs/heads/other-branch", "utf8")).toEqual("67fd42fe");
  });
});
