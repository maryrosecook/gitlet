var fs = require('fs');
var g = require('../gimlet-api');
var testUtil = require('./test-util');

describe('hash-object', function() {
  beforeEach(testUtil.createEmptyRepo);

  it('should throw if not in repo', function() {
    expect(function() { g.hash_object(); })
      .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
  });

  it('should throw if file specified does not exist', function() {
    g.init();
    expect(function() { g.hash_object("not-there") })
      .toThrow("fatal: Cannot open 'not-there': No such file or directory");
  });

  it('should return unique (!) hash of contents when file passed with no -w', function() {
    g.init();

    fs.writeFileSync("a.txt", "taoehusnaot uhrs.ochurcaoh. usrcao.h usrc oa.husrc aosr.ot");
    expect(g.hash_object("a.txt")).toEqual("7f9f2dae");

    fs.writeFileSync("b.txt", "oetuhntoaehuntao hesuh sano.tuh snato.h usntaho .u");
    expect(g.hash_object("b.txt")).toEqual("71dc6f5a");
  });

  it('should store blob and return hash when file passed with -w', function() {
    var content = "taoehusnaot uhrs.ochurcaoh. usrcao.h usrc oa.husrc aosr.ot";
    g.init();
    fs.writeFileSync("a.txt", content);
    expect(g.hash_object("a.txt", { w:true })).toEqual("7f9f2dae");
    testUtil.expectFile(__dirname + "/tmp/.gimlet/objects/7f9f2dae", content);
  });

  it('should not store blob when -w not passed', function() {
    var content = "taoehusnaot uhrs.ochurcaoh. usrcao.h usrc oa.husrc aosr.ot";
    g.init();
    fs.writeFileSync("a.txt", content);

    var objectPath = __dirname + "/tmp/.gimlet/objects/" + g.hash_object("a.txt");
    expect(fs.existsSync(objectPath, "utf8")).toEqual(false);

    // check that file is stored with -w
    g.hash_object("a.txt", { w: true });
    expect(fs.existsSync(objectPath, "utf8")).toEqual(true);
  });
});
