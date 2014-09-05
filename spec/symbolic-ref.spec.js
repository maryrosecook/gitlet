var fs = require('fs');
var g = require('../gimlet-api');
var testUtil = require('./test-util');

describe('update-ref', function() {
  beforeEach(testUtil.createEmptyRepo);

  it('should throw if not in repo', function() {
    expect(function() { g.symbolic_ref(); })
      .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
  });

  it('should throw if ref to update is not HEAD', function() {
    g.init();
    expect(function() { g.symbolic_ref("HEA"); })
      .toThrow("fatal: ref HEA is not a symbolic ref");
    expect(function() { g.symbolic_ref(""); })
      .toThrow("fatal: ref  is not a symbolic ref");

    g.symbolic_ref("HEAD"); // no throw
  });

  it('should throw if ref to update to is not of form refs/heads/blah', function() {
    g.init();
    expect(function() { g.symbolic_ref("HEAD", ""); })
      .toThrow("fatal: Refusing to point HEAD outside of refs/heads/");
    expect(function() { g.symbolic_ref("HEAD", "refs/woo"); })
      .toThrow("fatal: Refusing to point HEAD outside of refs/heads/");
    expect(function() { g.symbolic_ref("HEAD", "HEAD"); })
      .toThrow("fatal: Refusing to point HEAD outside of refs/heads/");

    g.symbolic_ref("HEAD", "refs/heads/woo");
  });

  it('should point HEAD at thing inside refs/heads/ that does not exist', function() {
    g.init();
    g.symbolic_ref("HEAD", "refs/heads/woo");
    testUtil.expectFile(".gimlet/HEAD", "ref: refs/heads/woo\n");
  });

  it('should return ref in HEAD if only HEAD passed', function() {
    g.init();
    expect(g.symbolic_ref("HEAD")).toEqual("refs/heads/master");
  });

  it('should return hash in HEAD if only HEAD passed', function() {
    g.init();
    fs.writeFileSync(".gimlet/HEAD", "cuo89ou3");
    expect(g.symbolic_ref("HEAD")).toEqual("cuo89ou3");
  });
});
