var fs = require('fs');
var ga = require('../src/gitlet-api');
var testUtil = require('./test-util');

describe('write-tree', function() {
  beforeEach(testUtil.createEmptyRepo);

  it('should throw if not in repo', function() {
    expect(function() { ga.write_tree(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it('should be able to write largish tree when no trees written yet', function() {
    ga.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                          { "filec": "filec", "3":
                                            { "filed": "filed", "filee": "filee"}}}});
    ga.add("1");
    expect(ga.write_tree()).toEqual("7afc965a");

    // check only trees
    testUtil.expectFile(".gitlet/objects/7afc965a", "tree 380b9be6 1\n");
    testUtil.expectFile(".gitlet/objects/380b9be6",
                        "tree 1c778a9 2\nblob 5ceba65 filea\nblob 5ceba66 fileb\n");
    testUtil.expectFile(".gitlet/objects/1c778a9", "tree 51125fde 3\nblob 5ceba67 filec\n");
    testUtil.expectFile(".gitlet/objects/51125fde", "blob 5ceba68 filed\nblob 5ceba69 filee\n");
  });

  it('should keep blobs written by git add', function() {
    ga.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                          { "filec": "filec", "3":
                                            { "filed": "filed", "filee": "filee"}}}});
    ga.add("1");
    ga.write_tree();

    // check only blobs
    testUtil.expectFile(".gitlet/objects/5ceba65", "filea");
    testUtil.expectFile(".gitlet/objects/5ceba66", "fileb");
    testUtil.expectFile(".gitlet/objects/5ceba67", "filec");
    testUtil.expectFile(".gitlet/objects/5ceba68", "filed");
    testUtil.expectFile(".gitlet/objects/5ceba69", "filee");
  });

  it('should omit files in trees above dir that is several layers down', function() {
    ga.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                          { "filec": "filec", "3":
                                            { "filed": "filed", "filee": "filee"}}}});
    ga.add("1/2");
    expect(ga.write_tree()).toEqual("45cddb46");

    testUtil.expectFile(".gitlet/objects/45cddb46", "tree 37ebbafc 1\n");
    testUtil.expectFile(".gitlet/objects/37ebbafc", "tree 1c778a9 2\n");
    testUtil.expectFile(".gitlet/objects/1c778a9", "tree 51125fde 3\nblob 5ceba67 filec\n");
    testUtil.expectFile(".gitlet/objects/51125fde", "blob 5ceba68 filed\nblob 5ceba69 filee\n");
  });

  it('should compose tree from new and existing trees and blobs', function() {
    ga.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                          { "filec": "filec",
                                            "3a": { "filed": "filed", "filee": "filee"},
                                            "3b": { "filef": "filef", "fileg": "fileg"}}}});

    var _3aHash = "51125fde";
    var _3bHash = "3b5029be";

    ga.add("1/2/3a");
    expect(ga.write_tree()).toEqual("59431df");
    testUtil.expectFile(".gitlet/objects/59431df", "tree 2711fbd9 1\n");
    testUtil.expectFile(".gitlet/objects/2711fbd9", "tree 74f6972d 2\n");
    testUtil.expectFile(".gitlet/objects/74f6972d", "tree " + _3aHash + " 3a\n");
    testUtil.expectFile(".gitlet/objects/" + _3aHash, "blob 5ceba68 filed\nblob 5ceba69 filee\n");
    expect(fs.readdirSync(".gitlet/objects").length).toEqual(6);

    ga.add("1/2/3b");
    expect(ga.write_tree()).toEqual("53d8eab5");
    testUtil.expectFile(".gitlet/objects/53d8eab5", "tree 494c2c41 1\n");
    testUtil.expectFile(".gitlet/objects/494c2c41", "tree 9c02fdc 2\n");
    testUtil.expectFile(".gitlet/objects/9c02fdc",
                        "tree " + _3aHash + " 3a\ntree " + _3bHash + " 3b\n");
    testUtil.expectFile(".gitlet/objects/" + _3bHash, "blob 5ceba6a filef\nblob 5ceba6b fileg\n");
    expect(fs.readdirSync(".gitlet/objects").length).toEqual(12);
  });

  it('should write-tree of empty root tree if no files staged', function() {
    ga.init();
    expect(ga.write_tree()).toEqual("a");
  });
});
