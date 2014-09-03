var fs = require('fs');
var g = require('../gimlet-api');
var testUtil = require('./test-util');

describe('branch', function() {
  beforeEach(testUtil.createEmptyRepo);

  it('should throw if not in repo', function() {
    expect(function() { g.branch(); })
      .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
  });

  it('should throw if master has not been created', function() {
    g.init();
    expect(function() { g.branch("woo"); })
      .toThrow("fatal: Not a valid object name: 'master'.");
  });

  it('should create new branch pointed at HEAD when call branch w branch name', function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea"}});
    g.add("1/filea");
    g.commit({ m: "first", date: new Date(1409404605356) });
    g.branch("woo");
    testUtil.expectFile(".gimlet/refs/heads/woo", "48946d55");
  });

  it('should should leave master pointed at orig hash after branching', function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea"}});
    g.add("1/filea");
    g.commit({ m: "first", date: new Date(1409404605356) });
    testUtil.expectFile(".gimlet/refs/heads/master", "48946d55");
    g.branch("woo");
    testUtil.expectFile(".gimlet/refs/heads/master", "48946d55");
  });

  it('should return list of branches when called with no args', function() {
    g.init();
    testUtil.createFilesFromTree({ "1": { "filea": "filea"}});
    g.add("1/filea");
    g.commit({ m: "first", date: new Date(1409404605356) });
    g.branch("woo");
    g.branch("boo");
    expect(g.branch()).toEqual("  boo\n* master\n  woo\n");
  });
});
