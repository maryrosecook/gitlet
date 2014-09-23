var fs = require('fs');
var ga = require('../gimlet-api');
var testUtil = require('./test-util');

describe('diff', function() {
  beforeEach(testUtil.createEmptyRepo);

  it('should throw if not in repo', function() {
    expect(function() { ga.diff(); })
      .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
  });

  it('should throw if do not pass --name-only option', function() {
    ga.init();
    expect(function() { ga.diff(undefined, undefined, {}); }).toThrow("unsupported");
  });

  it('should throw unknown revision if ref1 not in objects', function() {
    ga.init();
    ga.diff("ou.nch3thountounchcn3", undefined, { "name-only": true });
  });

  it('should throw unknown revision if ref2 not in objects', function() {
    ga.init();
    ga.diff(undefined, "ou.nch3thountounchcn3", { "name-only": true });
  });

});
