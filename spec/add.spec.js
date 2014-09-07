var fs = require('fs');
var ga = require('../gimlet-api');
var testUtil = require('./test-util');

describe('add', function() {
  beforeEach(testUtil.createEmptyRepo);

  it('should throw if not in repo', function() {
    expect(function() { ga.add(); })
      .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
  });

  describe('pathspec matching', function() {
    it('should throw rel path if in root and pathspec does not match files', function() {
      ga.init();
      expect(function() {
        ga.add("blah");
      }).toThrow("fatal: pathspec 'blah' did not match any files");
    });

    it('should throw rel path if not in root and pathspec does not match files', function() {
      ga.init();
      testUtil.createFilesFromTree({ "1": { "2": {}}})
      process.chdir("1/2");
      expect(function() {
        ga.add("blah");
      }).toThrow("fatal: pathspec '1/2/blah' did not match any files");
    });
  });

  describe('adding files', function() {
    it('should be able to add single file in sub dir', function() {
      // regression test
      ga.init();
      testUtil.createFilesFromTree({ "1": { "filea": "filea" }});
      ga.add("1/filea");
      expect(testUtil.index()[0].path).toEqual("1/filea");
      expect(testUtil.index().length).toEqual(1);
    });

    it('should add all files in a large dir tree', function() {
      ga.init();
      testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                            { "filec": "filec", "3":
                                              { "filed": "filed", "filee": "filee"}}}});
      ga.add("1");
      expect(testUtil.index()[0].path).toEqual("1/2/3/filed");
      expect(testUtil.index()[1].path).toEqual("1/2/3/filee");
      expect(testUtil.index()[2].path).toEqual("1/2/filec");
      expect(testUtil.index()[3].path).toEqual("1/filea");
      expect(testUtil.index()[4].path).toEqual("1/fileb");
      expect(testUtil.index().length).toEqual(5);
    });

    it('should add only files in specified subdir', function() {
      ga.init();
      testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                            { "filec": "filec", "3":
                                              { "filed": "filed", "filee": "filee"}}}});
      ga.add("1/2");
      expect(testUtil.index()[0].path).toEqual("1/2/3/filed");
      expect(testUtil.index()[1].path).toEqual("1/2/3/filee");
      expect(testUtil.index()[2].path).toEqual("1/2/filec");
      expect(testUtil.index().length).toEqual(3);
    });

    it('should be able to add multiple sets of files', function() {
      ga.init();
      testUtil.createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                            { "filec": "filec", "3a":
                                              { "filed": "filed", "filee": "filee"}, "3b":
                                              { "filef": "filef", "fileg": "fileg"}}}});
      ga.add("1/2/3a");
      expect(testUtil.index()[0].path).toEqual("1/2/3a/filed");
      expect(testUtil.index()[1].path).toEqual("1/2/3a/filee");
      expect(testUtil.index().length).toEqual(2);

      ga.add("1/2/3b");
      expect(testUtil.index()[0].path).toEqual("1/2/3a/filed");
      expect(testUtil.index()[1].path).toEqual("1/2/3a/filee");
      expect(testUtil.index()[2].path).toEqual("1/2/3b/filef");
      expect(testUtil.index()[3].path).toEqual("1/2/3b/fileg");
      expect(testUtil.index().length).toEqual(4);
    });
  });
});
