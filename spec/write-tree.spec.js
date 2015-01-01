var fs = require("fs");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

describe("write-tree", function() {
  beforeEach(testUtil.initTestDataDir);

  it("should throw if not in repo", function() {
    expect(function() { g.write_tree(); })
      .toThrow("not a Gitlet repository");
  });

  it("should be able to write largish tree when no trees written yet", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1b");
    expect(g.write_tree()).toEqual("391566d4");

    // check only trees
    testUtil.expectFile(".gitlet/objects/391566d4", "tree 18088c87 1b\n");
    testUtil.expectFile(".gitlet/objects/18088c87",
                        "tree 752d7973 2b\nblob 5ceba66 fileb\n");
    testUtil.expectFile(".gitlet/objects/752d7973", "tree 4b6b7518 3b\nblob 5ceba67 filec\n");
  });

  it("should keep blobs written by git add", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1b");
    g.write_tree();

    // check only blobs
    testUtil.expectFile(".gitlet/objects/5ceba66", "fileb");
    testUtil.expectFile(".gitlet/objects/5ceba67", "filec");
  });

  it("should omit files in trees above dir that is several layers down", function() {
    g.init();
    testUtil.createStandardFileStructure();
    g.add("1b/2b");
    expect(g.write_tree()).toEqual("133bcd6");

    testUtil.expectFile(".gitlet/objects/133bcd6", "tree aacf336 1b\n"); // note no 1a
  });

  it("should compose tree from new and existing trees and blobs", function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                          { "filec": "filec",
                                            "3a": { "filed": "filed", "filee": "filee"},
                                            "3b": { "filef": "filef", "fileg": "fileg"}}}});

    var _3aHash = "51125fde";
    var _3bHash = "3b5029be";

    g.add("1/2/3a");
    expect(g.write_tree()).toEqual("59431df");
    testUtil.expectFile(".gitlet/objects/59431df", "tree 2711fbd9 1\n");
    testUtil.expectFile(".gitlet/objects/2711fbd9", "tree 74f6972d 2\n");
    testUtil.expectFile(".gitlet/objects/74f6972d", "tree " + _3aHash + " 3a\n");
    testUtil.expectFile(".gitlet/objects/" + _3aHash, "blob 5ceba68 filed\nblob 5ceba69 filee\n");
    expect(fs.readdirSync(".gitlet/objects").length).toEqual(6);

    g.add("1/2/3b");
    expect(g.write_tree()).toEqual("53d8eab5");
    testUtil.expectFile(".gitlet/objects/53d8eab5", "tree 494c2c41 1\n");
    testUtil.expectFile(".gitlet/objects/494c2c41", "tree 9c02fdc 2\n");
    testUtil.expectFile(".gitlet/objects/9c02fdc",
                        "tree " + _3aHash + " 3a\ntree " + _3bHash + " 3b\n");
    testUtil.expectFile(".gitlet/objects/" + _3bHash, "blob 5ceba6a filef\nblob 5ceba6b fileg\n");
    expect(fs.readdirSync(".gitlet/objects").length).toEqual(12);
  });

  it("should write-tree of empty root tree if no files staged", function() {
    g.init();
    expect(g.write_tree()).toEqual("a");
  });
});
