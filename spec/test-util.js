var fs = require("fs");
var nodePath = require("path");

var originalDateToString = Date.prototype.toString;

var testUtil = module.exports = {
  expectFile: function(path, content) {
    expect(fs.readFileSync(path, "utf8")).toEqual(content);
  },

  rmdirSyncRecursive: function(dir) {
    fs.readdirSync(dir).forEach(function(fileName) {
      var filePath = nodePath.join(dir, fileName);
      if (fs.statSync(filePath).isDirectory()) {
        testUtil.rmdirSyncRecursive(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    });

    fs.rmdirSync(dir);
  },

  createFilesFromTree: function(structure, prefix) {
    if (prefix === undefined) return testUtil.createFilesFromTree(structure, process.cwd());

    Object.keys(structure).forEach(function(name) {
      var path = nodePath.join(prefix, name);
      if (typeof structure[name] === "string") {
        fs.writeFileSync(path, structure[name]);
      } else {
        fs.mkdirSync(path, "777");
        testUtil.createFilesFromTree(structure[name], path);
      }
    });
  },

  createStandardFileStructure: function() {
    testUtil.createFilesFromTree({ "1a": { filea: "filea" },
                                   "1b": { fileb: "fileb",
                                           "2b": { filec: "filec",
                                                   "3b": {
                                                     "4b": { filed: "filed" }}}}});
  },

  index: function() {
    return fs.readFileSync(".gitlet/index", "utf8")
      .split("\n")
      .slice(0, -1)
      .map(function(blobStr) {
        var blobData = blobStr.split(/ /);
        return { path: blobData[0], hash: blobData[1] };
      });
  },

  initTestDataDir: function() {
    var testDataDir = __dirname + "/testData";

    if (fs.existsSync(testDataDir)) {
      testUtil.rmdirSyncRecursive(testDataDir);
    }

    fs.mkdirSync(testDataDir);
    process.chdir(testDataDir);
    fs.mkdirSync("repo1");
    process.chdir("repo1");
    expect(fs.readdirSync(process.cwd()).length).toEqual(0);
  },

  makeRemoteRepo: function() {
    process.chdir("../");
    fs.mkdirSync("sub");
    process.chdir("sub");
    fs.mkdirSync("repo2");
    process.chdir("repo2");
    return process.cwd();
  },

  pinDate: function() {
    global.Date.prototype.toString = function() {
      return "Sat Aug 30 2014 09:16:45 GMT-0400 (EDT)";
    };
  },

  unpinDate: function() {
    global.Date.prototype.toString = originalDateToString;
  }
};
