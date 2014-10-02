var fs = require('fs');
var ga = require('../src/gitlet-api');
var nodePath = require('path');
var testUtil = require('./test-util');

describe('commit', function() {
  beforeEach(testUtil.createEmptyRepo);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it('should throw if not in repo', function() {
    expect(function() { ga.commit(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it('should throw and explain how to stage if index empty', function() {
    expect(function() {
      ga.init();
      ga.commit();
    }).toThrow("# On branch master\n#\n# Initial commit\n#\n" +
               "nothing to commit (create/copy files and use 'git add' to track)");
  });

  it('should throw if nothing to commit now, but there were previous commits', function() {
    ga.init();
    testUtil.createStandardFileStructure();
    ga.add("1b");
    ga.commit({ m: "first" });

    expect(function() {
      ga.commit();
    }).toThrow("# On master\n" +
               "nothing to commit, working directory clean");
  });

  it('should create commit file when initially commiting', function() {
    ga.init();
    testUtil.createStandardFileStructure();
    ga.add("1b");
    ga.commit({ m: "first" });

    var commitFile = fs.readFileSync(".gitlet/objects/6e7887a2", "utf8");
    expect(commitFile.split("\n")[0]).toEqual("commit 391566d4");
    expect(commitFile.split("\n")[1])
      .toEqual("Date:  Sat Aug 30 2014 09:16:45 GMT-0400 (EDT)");
    expect(commitFile.split("\n")[2]).toEqual("");
    expect(commitFile.split("\n")[3]).toEqual("    first");
  });

  it('should initial commit file should have no parents', function() {
    ga.init();
    testUtil.createStandardFileStructure();
    ga.add("1b");
    ga.commit({ m: "first" });
    fs.readFileSync(".gitlet/objects/6e7887a2", "utf8").split("\n")[1].match("Date:");
  });

  it('should store parent on all commits after first', function() {
    ga.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb", filec: "filec" });

    ga.add("filea");
    ga.commit({ m: "first" });
    var firstHash = fs.readFileSync(".gitlet/refs/heads/master", "utf8");

    ga.add("fileb");
    ga.commit({ m: "second" });
    var secondHash = fs.readFileSync(".gitlet/refs/heads/master", "utf8");

    ga.add("filec");
    ga.commit({ m: "third" });
    var thirdHash = fs.readFileSync(".gitlet/refs/heads/master", "utf8");

    expect(fs.readFileSync(".gitlet/objects/" + secondHash, "utf8").split("\n")[1]).toEqual("parent " + firstHash);
    expect(fs.readFileSync(".gitlet/objects/" + thirdHash, "utf8").split("\n")[1]).toEqual("parent " + secondHash);
  });

  it('should point current branch at commit when committing', function() {
    ga.init();
    testUtil.createStandardFileStructure();
    ga.add("1b");
    ga.commit({ m: "first" });
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("6e7887a2");
  });

  it('should record subsequent commit object', function() {
    ga.init();
    testUtil.createStandardFileStructure();
    ga.add("1a");
    ga.commit({ m: "first" });
    ga.add("1b");
    ga.commit({ m: "second" });

    var commitFileLines1 = fs.readFileSync(".gitlet/objects/21cb63f6", "utf8").split("\n");
    expect(commitFileLines1[0]).toEqual("commit 63e0627e");
    expect(commitFileLines1[3]).toEqual("    first");

    var commitFileLines2 = fs.readFileSync(".gitlet/objects/59bb8412", "utf8").split("\n");
    expect(commitFileLines2[0]).toEqual("commit 566d6fea");
    expect(commitFileLines2[4]).toEqual("    second");
  });

  it('should point current branch at subsequent commits', function() {
    ga.init();
    testUtil.createStandardFileStructure();
    ga.add("1a");
    ga.commit({ m: "first" });
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("21cb63f6");

    ga.add("1b");
    ga.commit({ m: "second" });
    expect(fs.readFileSync(".gitlet/refs/heads/master", "utf8")).toEqual("59bb8412");
  });

  it('should create commit without passing date', function() {
    ga.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb" }});
    ga.add("1");
    ga.commit({ m: "first" });

    fs.readdirSync(".gitlet/objects/").forEach(function(filename) {
      var contents = fs.readFileSync(nodePath.join(".gitlet/objects", filename), "utf8");
      if (contents.split(" ")[0] === "commit") {
        var lines = contents.split("\n");

        var dateStr = lines[1].split(" ").slice(1).join(" ");
        expect(new Date(dateStr).getFullYear() > 2013).toEqual(true);

        expect(lines[2]).toEqual("");
        expect(lines[3]).toEqual("    first");
      }
    });
  });

  it('should complain nothing to commit if only changes are unstaged', function() {
    testUtil.createStandardFileStructure();
    ga.init();
    ga.add("1a/filea");
    ga.commit({ m: "first" });
    fs.writeFileSync("1a/filea", "somethingelse");
    expect(function() { ga.commit({ m: "second" }); })
      .toThrow("# On master\nnothing to commit, working directory clean");
  });

  // it('should allow checking out commit', function() {
  // });

  // it('should warn when user goes into detached HEAD state', function() {
  // });

  // it('should indicate detached HEAD after committing to detached HEAD', function() {
  // });
});
