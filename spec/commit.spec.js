var fs = require('fs');
var g = require('../gimlet-api');
var nodePath = require('path');
var testUtil = require('./test-util');

describe('commit', function() {
  beforeEach(testUtil.createEmptyRepo);

  it('should throw if not in repo', function() {
    expect(function() { g.commit(); })
      .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
  });

  it('should throw and explain how to stage if index empty', function() {
    expect(function() {
      g.init();
      g.commit();
    }).toThrow("# On branch master\n#\n# Initial commit\n#\n" +
               "nothing to commit (create/copy files and use 'git add' to track)");
  });

  it('should create commit file when initially commiting', function() {
    g.init();
    var date = new Date(1409404605356);
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                          { "filec": "filec", "3":
                                            { "filed": "filed", "filee": "filee"}}}});
    g.add("1");
    g.commit({ m: "first", date: date });

    var commitFile = fs.readFileSync(".gimlet/objects/1ff21fcc", "utf8");
    expect(commitFile.split("\n")[0]).toEqual("commit 7afc965a");
    expect(commitFile.split("\n")[1])
      .toEqual("Date:  Sat Aug 30 2014 09:16:45 GMT-0400 (EDT)");
    expect(commitFile.split("\n")[2]).toEqual("");
    expect(commitFile.split("\n")[3]).toEqual("    first");
  });

  it('should initial commit file should have no parents', function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                          { "filec": "filec", "3":
                                            { "filed": "filed", "filee": "filee"}}}});
    g.add("1");
    g.commit({ m: "first", date: new Date(1409404605356) });
    fs.readFileSync(".gimlet/objects/1ff21fcc", "utf8").split("\n")[1].match("Date:");
  });

  it('should store parent on all commits after first', function() {
    g.init();
    testUtil.createFilesFromTree({ filea: "filea", fileb: "fileb", filec: "filec" });

    g.add("filea");
    g.commit({ m: "first", date: new Date(1409404605356) });
    var firstHash = fs.readFileSync(".gimlet/refs/heads/master", "utf8");

    g.add("fileb");
    g.commit({ m: "second", date: new Date(1409404605356) });
    var secondHash = fs.readFileSync(".gimlet/refs/heads/master", "utf8");

    g.add("filec");
    g.commit({ m: "third", date: new Date(1409404605356) });
    var thirdHash = fs.readFileSync(".gimlet/refs/heads/master", "utf8");

    expect(fs.readFileSync(".gimlet/objects/" + secondHash, "utf8").split("\n")[1]).toEqual("parent " + firstHash);
    expect(fs.readFileSync(".gimlet/objects/" + thirdHash, "utf8").split("\n")[1]).toEqual("parent " + secondHash);
  });

  it('should point current branch at commit when committing', function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                          { "filec": "filec", "3":
                                            { "filed": "filed", "filee": "filee"}}}});
    g.add("1");
    g.commit({ m: "first", date: new Date(1409404605356) });
    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("1ff21fcc");
  });

  it('should record subsequent commit object', function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                          { "filec": "filec", "3a":
                                            { "filed": "filed", "filee": "filee"}, "3b":
                                            { "filef": "filef", "fileg": "fileg"}}}});
    g.add("1/2/3a");
    g.commit({ m: "first", date: new Date(1409404605356) });
    g.add("1/2/3b");
    g.commit({ m: "second", date: new Date(1409404605356) });

    var commitFileLines1 = fs.readFileSync(".gimlet/objects/343b3d02", "utf8").split("\n");
    expect(commitFileLines1[0]).toEqual("commit 59431df");
    expect(commitFileLines1[3]).toEqual("    first");

    var commitFileLines2 = fs.readFileSync(".gimlet/objects/5e0b3550", "utf8").split("\n");
    expect(commitFileLines2[0]).toEqual("commit 53d8eab5");
    expect(commitFileLines2[4]).toEqual("    second");
  });

  it('should point current branch at subsequent commits', function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                          { "filec": "filec", "3a":
                                            { "filed": "filed", "filee": "filee"}, "3b":
                                            { "filef": "filef", "fileg": "fileg"}}}});
    g.add("1/2/3a");
    g.commit({ m: "first", date: new Date(1409404605356) });
    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("343b3d02");

    g.add("1/2/3b");
    g.commit({ m: "second", date: new Date(1409404605356) });
    expect(fs.readFileSync(".gimlet/refs/heads/master", "utf8")).toEqual("5e0b3550");
  });

  it('should create commit without passing date', function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb" }});
    g.add("1");
    g.commit({ m: "first" });

    fs.readdirSync(".gimlet/objects/").forEach(function(filename) {
      var contents = fs.readFileSync(nodePath.join(".gimlet/objects", filename)).toString();
      if (contents.split(" ")[0] === "commit") {
        var lines = contents.split("\n");

        var dateStr = lines[1].split(" ").slice(1).join(" ");
        expect(new Date(dateStr).getFullYear() > 2013).toEqual(true);

        expect(lines[2]).toEqual("");
        expect(lines[3]).toEqual("    first");
      }
    });
  });
});
