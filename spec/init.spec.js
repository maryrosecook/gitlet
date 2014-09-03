var fs = require('fs');
var g = require('../gimlet-api');
var testUtil = require('./test-util');

describe('init', function() {
  beforeEach(testUtil.createEmptyRepo);

  function expectGimletFilesAndDirectories() {
    expect(fs.existsSync(__dirname + "/tmp/.gimlet/objects/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/heads/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/remotes/")).toEqual(true);
    expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/remotes/origin/")).toEqual(true);

    testUtil.expectFile(__dirname + "/tmp/.gimlet/HEAD", "ref: refs/heads/master\n");
  };

  it('should create .gimlet/ and all required dirs', function() {
    g.init();
    expectGimletFilesAndDirectories();
  });

  it('should not change anything if init run twice', function() {
    g.init();
    g.init();
    expectGimletFilesAndDirectories();
  });
});
