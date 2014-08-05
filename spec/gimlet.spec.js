var fs = require('fs');
var g = require('../gimlet');

var TEST_DATA_DIR = __dirname + "/tmp";

describe('gimlet', function() {
  beforeEach(function() {
    if (fs.exists(TEST_DATA_DIR)) {
      fs.rmdirSync(TEST_DATA_DIR);
    }

    fs.mkdirSync(TEST_DATA_DIR);
  });

  describe('init', function() {
    it('should create a .git directory', function() {
      g.init(TEST_DATA_DIR);
    });
  });
});
