var fs = require('fs');
var ga = require('../src/gitlet-api');
var testUtil = require('./test-util');

describe('branch', function() {
  beforeEach(testUtil.createEmptyRepo);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it('should throw if not in repo', function() {
    expect(function() { ga.branch(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it('should throw if master has not been created', function() {
    ga.init();
    expect(function() { ga.branch("woo"); })
      .toThrow("fatal: Not a valid object name: 'master'.");
  });

  it('should create new branch pointed at HEAD when call branch w branch name', function() {
    ga.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea"}});
    ga.add("1/filea");
    ga.commit({ m: "first" });
    ga.branch("woo");
    testUtil.expectFile(".gitlet/refs/heads/woo", "48946d55");
  });

  it('should should leave master pointed at orig hash after branching', function() {
    ga.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea"}});
    ga.add("1/filea");
    ga.commit({ m: "first" });
    testUtil.expectFile(".gitlet/refs/heads/master", "48946d55");
    ga.branch("woo");
    testUtil.expectFile(".gitlet/refs/heads/master", "48946d55");
  });

  it('should return list of branches when called with no args', function() {
    ga.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea"}});
    ga.add("1/filea");
    ga.commit({ m: "first" });
    ga.branch("woo");
    ga.branch("boo");
    expect(ga.branch()).toEqual("  boo\n* master\n  woo\n");
  });
});
