var fs = require('fs');
var g = require('../gimlet-api');
var testUtil = require('./test-util');

describe('checkout', function() {
  beforeEach(testUtil.createEmptyRepo);

  it('should throw if not in repo', function() {
    expect(function() { g.checkout(); })
      .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
  });
});
