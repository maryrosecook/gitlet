var fs = require('fs');
var g = require('../gimlet');
var ga = require('../gimlet-api');
var testUtil = require('./test-util');

describe('gimlet cli', function() {
  beforeEach(testUtil.createEmptyRepo);

  describe('missing args', function() {
    it('should allow two missing args (ref1 and ref2)', function() {
      ga.init();
      expect(g(["node", "gimlet.js", "diff", "--name-status"])).toEqual("\n");
    });
  });

  describe('running each gimlet command under normal circs', function() {
    it('gimlet init a repo', function() {
      g(["node", "gimlet.js", "init"]);
      testUtil.expectFile(__dirname + "/tmp/.gimlet/HEAD", "ref: refs/heads/master\n");
    });

    it('gimlet add a file', function() {
      testUtil.createFilesFromTree({ "1": { filea: "filea" }});
      ga.init();
      g(["node", "gimlet.js", "add", "1/filea"]);
      expect(testUtil.index()[0].path).toEqual("1/filea");
      expect(testUtil.index().length).toEqual(1);
    });

    it('gimlet make new branch', function() {
      testUtil.pinDate();

      testUtil.createFilesFromTree({ "1": { filea: "filea" }});
      ga.init();
      ga.add("1/filea");
      ga.commit({ m: "blah" });
      g(["node", "gimlet.js", "branch", "woo"]);
      testUtil.expectFile(".gimlet/refs/heads/woo", "6db3fd6a");

      testUtil.unpinDate();
    });

    it('commit', function() {
      testUtil.pinDate();

      testUtil.createFilesFromTree({ "1": { filea: "filea" }});
      ga.init();
      ga.add("1/filea");
      g(["node", "gimlet.js", "commit", "-m", "blah"]);
      testUtil.expectFile(".gimlet/refs/heads/master", "6db3fd6a");

      testUtil.unpinDate();
    });

    it('hash-object and write', function() {
      testUtil.createFilesFromTree({ "1": { filea: "filea" }});
      ga.init();
      g(["node", "gimlet.js", "hash-object", "1/filea", "-w"]);
      testUtil.expectFile(".gimlet/objects/5ceba65", "filea");
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

      g(["node", "gimlet.js", "update-ref", "HEAD", "343b3d02"]);

      expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("343b3d02");

      testUtil.unpinDate();
    });

    it('should be able to write largish tree when no trees written yet', function() {
      ga.init();
      testUtil.createFilesFromTree({ "1": { filea: "filea", fileb: "fileb", "2":
                                            { filec: "filec", "3":
                                              { filed: "filed", filee: "filee"}}}});
      ga.add("1");
      expect(g(["node", "gimlet.js", "write-tree"])).toEqual("7afc965a");
    });
  });
});
