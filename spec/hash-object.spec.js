var fs = require("fs");
var ga = require("../src/gitlet-api");
var testUtil = require("./test-util");

describe("hash-object", function() {
  beforeEach(testUtil.createEmptyRepo);

  it("should throw if not in repo", function() {
    expect(function() { ga.hash_object(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it("should throw if file specified does not exist", function() {
    ga.init();
    expect(function() { ga.hash_object("not-there") })
      .toThrow("fatal: Cannot open 'not-there': No such file or directory");
  });

  it("should return unique (!) hash of contents when file passed with no -w", function() {
    ga.init();

    fs.writeFileSync("a.txt", "taoehusnaot uhrs.ochurcaoh. usrcao.h usrc oa.husrc aosr.ot");
    expect(ga.hash_object("a.txt")).toEqual("7f9f2dae");

    fs.writeFileSync("b.txt", "oetuhntoaehuntao hesuh sano.tuh snato.h usntaho .u");
    expect(ga.hash_object("b.txt")).toEqual("71dc6f5a");
  });

  it("should store blob and return hash when file passed with -w", function() {
    var content = "taoehusnaot uhrs.ochurcaoh. usrcao.h usrc oa.husrc aosr.ot";
    ga.init();
    fs.writeFileSync("a.txt", content);
    expect(ga.hash_object("a.txt", { w:true })).toEqual("7f9f2dae");
    testUtil.expectFile(__dirname + "/tmp/.gitlet/objects/7f9f2dae", content);
  });

  it("should not store blob when -w not passed", function() {
    var content = "taoehusnaot uhrs.ochurcaoh. usrcao.h usrc oa.husrc aosr.ot";
    ga.init();
    fs.writeFileSync("a.txt", content);

    var objectPath = __dirname + "/tmp/.gitlet/objects/" + ga.hash_object("a.txt");
    expect(fs.existsSync(objectPath, "utf8")).toEqual(false);

    // check that file is stored with -w
    ga.hash_object("a.txt", { w: true });
    expect(fs.existsSync(objectPath, "utf8")).toEqual(true);
  });
});
