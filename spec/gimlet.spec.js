var fs = require('fs');
var g = require('../src/gitlet');
var ga = require('../src/gitlet-api');
var testUtil = require('./test-util');

describe('gitlet cli', function() {
  beforeEach(testUtil.createEmptyRepo);

  describe('missing args', function() {
    it('should allow two missing args (ref1 and ref2)', function() {
      ga.init();
      expect(g(["node", "gitlet", "diff", "--name-status"])).toEqual("\n");
    });
  });

  describe('running each gitlet command under normal circs', function() {
    it('gitlet init a repo', function() {
      g(["node", "gitlet", "init"]);
      testUtil.expectFile(__dirname + "/tmp/.gitlet/HEAD", "ref: refs/heads/master\n");
    });

    it('gitlet add a file', function() {
      testUtil.createFilesFromTree({ "1": { filea: "filea" }});
      ga.init();
      g(["node", "gitlet", "add", "1/filea"]);
      expect(testUtil.index()[0].path).toEqual("1/filea");
      expect(testUtil.index().length).toEqual(1);
    });

    it('gitlet make new branch', function() {
      testUtil.pinDate();

      testUtil.createFilesFromTree({ "1": { filea: "filea" }});
      ga.init();
      ga.add("1/filea");
      ga.commit({ m: "blah" });
      g(["node", "gitlet", "branch", "woo"]);
      testUtil.expectFile(".gitlet/refs/heads/woo", "6db3fd6a");

      testUtil.unpinDate();
    });

    it('commit', function() {
      testUtil.pinDate();

      testUtil.createFilesFromTree({ "1": { filea: "filea" }});
      ga.init();
      ga.add("1/filea");
      g(["node", "gitlet", "commit", "-m", "blah"]);
      testUtil.expectFile(".gitlet/refs/heads/master", "6db3fd6a");

      testUtil.unpinDate();
    });

    it('hash-object and write', function() {
      testUtil.createFilesFromTree({ "1": { filea: "filea" }});
      ga.init();
      g(["node", "gitlet", "hash-object", "1/filea", "-w"]);
      testUtil.expectFile(".gitlet/objects/5ceba65", "filea");
    });

    it('update HEAD ref to prior commit', function() {
      testUtil.pinDate();

      ga.init();
      testUtil.createFilesFromTree({ "1": { filea: "filea", fileb: "fileb", "2":
                                            { filec: "filec", "3a":
                                              { filed: "filed", filee: "filee"}, "3b":
                                              { filef: "filef", fileg: "fileg"}}}});

      ga.add("1/2/3a");
      ga.commit({ m: "first" });
      ga.add("1/2/3b");
      ga.commit({ m: "second" });

      g(["node", "gitlet", "update-ref", "HEAD", "343b3d02"]);

      expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("343b3d02");

      testUtil.unpinDate();
    });

    it('should be able to write largish tree when no trees written yet', function() {
      ga.init();
      testUtil.createFilesFromTree({ "1": { filea: "filea", fileb: "fileb", "2":
                                            { filec: "filec", "3":
                                              { filed: "filed", filee: "filee"}}}});
      ga.add("1");
      expect(g(["node", "gitlet", "write-tree"])).toEqual("7afc965a");
    });
  });
});
