var fs = require('fs');
var ga = require('../gimlet-api');
var testUtil = require('./test-util');

describe('update-ref', function() {
  beforeEach(testUtil.createEmptyRepo);

  it('should throw if not in repo', function() {
    expect(function() { ga.symbolic_ref(); })
      .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
  });

  it('should throw if ref to update is not HEAD', function() {
    ga.init();
    expect(function() { ga.symbolic_ref("HEA"); })
      .toThrow("fatal: ref HEA is not a symbolic ref");
    expect(function() { ga.symbolic_ref(""); })
      .toThrow("fatal: ref  is not a symbolic ref");

    ga.symbolic_ref("HEAD"); // no throw
  });

  it('should throw if ref to update to is not of form refs/heads/blah', function() {
    ga.init();
    expect(function() { ga.symbolic_ref("HEAD", ""); })
      .toThrow("fatal: Refusing to point HEAD outside of refs/heads/");
    expect(function() { ga.symbolic_ref("HEAD", "refs/woo"); })
      .toThrow("fatal: Refusing to point HEAD outside of refs/heads/");
    expect(function() { ga.symbolic_ref("HEAD", "HEAD"); })
      .toThrow("fatal: Refusing to point HEAD outside of refs/heads/");

    ga.symbolic_ref("HEAD", "refs/heads/woo");
  });

  it('should point HEAD at thing inside refs/heads/ that does not exist', function() {
    ga.init();
    ga.symbolic_ref("HEAD", "refs/heads/woo");
    testUtil.expectFile(".gimlet/HEAD", "ref: refs/heads/woo\n");
  });

  it('should return ref in HEAD if only HEAD passed', function() {
    ga.init();
    expect(ga.symbolic_ref("HEAD")).toEqual("refs/heads/master");
  });

  it('should return hash in HEAD if only HEAD passed', function() {
    ga.init();
    fs.writeFileSync(".gimlet/HEAD", "cuo89ou3");
    expect(ga.symbolic_ref("HEAD")).toEqual("cuo89ou3");
  });
});
