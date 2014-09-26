var fs = require('fs');
var ga = require('../gimlet-api');
var testUtil = require('./test-util');

describe('diff', function() {
  beforeEach(testUtil.createEmptyRepo);

  it('should throw if not in repo', function() {
    expect(function() { ga.diff(); })
      .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
  });

  it('should throw if do not pass --name-status option', function() {
    ga.init();
    expect(function() { ga.diff(undefined, undefined, {}); }).toThrow("unsupported");
  });

  it('should throw unknown revision if ref1 not in objects', function() {
    ga.init();
    expect(function() { ga.diff("blah1", undefined, { "name-status": true }) })
      .toThrow("fatal: ambiguous argument blah1: unknown revision");
  });

  it('should throw unknown revision if ref2 not in objects', function() {
    ga.init();
    expect(function() { ga.diff("blah2", undefined, { "name-status": true }) })
      .toThrow("fatal: ambiguous argument blah2: unknown revision");
  });

  describe('no refs passed (index and WC)', function() {
    it('should show nothing for repo w no commits', function() {
      ga.init();
      expect(ga.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it('should not include unstaged files', function() {
      // this is because the file is never mentioned by the index,
      // which is to say: it doesn't compare absence against the WC hash.

      testUtil.createStandardFileStructure();
      ga.init();
      expect(ga.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it('should not include new file that is staged', function() {
      // this is because the file is in the index, but the version
      // in the WC is the same

      testUtil.createStandardFileStructure();
      ga.init();
      ga.add("1a");
      expect(testUtil.index()[0].path).toEqual("1a/filea");
      expect(ga.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });

    it('should not include commited file w no changes', function() {
      testUtil.createStandardFileStructure();
      ga.init();
      ga.add("1a");
      ga.commit({ m: "first" });
      expect(ga.diff(undefined, undefined, { "name-status": true })).toEqual("\n");
    });
  });
});
