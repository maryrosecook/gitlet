var fs = require('fs');
var ga = require('../src/gitlet-api');
var testUtil = require('./test-util');

describe('init', function() {
  beforeEach(testUtil.createEmptyRepo);

  function expectGitletFilesAndDirectories() {
    expect(fs.existsSync(__dirname + "/tmp/.gitlet/objects/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/tmp/.gitlet/refs/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/tmp/.gitlet/refs/heads/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/tmp/.gitlet/refs/remotes/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/tmp/.gitlet/refs/remotes/origin/")).toEqual(true);

    testUtil.expectFile(__dirname + "/tmp/.gitlet/HEAD", "ref: refs/heads/master\n");
  };

  it('should create .gitlet/ and all required dirs', function() {
    ga.init();
    expectGitletFilesAndDirectories();
  });

  it('should not change anything if init run twice', function() {
    ga.init();
    ga.init();
    expectGitletFilesAndDirectories();
  });
});
