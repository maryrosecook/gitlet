var fs = require('fs');
var g = require('../gimlet');

var TEST_DATA_DIR = __dirname + "/tmp/";

describe('gimlet', function() {
  beforeEach(function() {
    if (fs.existsSync(TEST_DATA_DIR)) {
      rmdirSyncRecursive(TEST_DATA_DIR);
    }

    fs.mkdirSync(TEST_DATA_DIR);
  });

  describe('init', function() {
    it('should create a .git directory', function() {
      g.init(TEST_DATA_DIR);
      expect(fs.existsSync(__dirname + "/tmp/.git")).toEqual(true);
    });
  });
});


var rmdirSyncRecursive = function(dir) {
  fs.readdirSync(dir).forEach(function(fileName) {
    var filePath = dir + fileName;
    if (fs.statSync(filePath).isDirectory()) {
      rmdirSyncRecursive(filePath);
    } else {
      fs.unlinkSync(filePath);
    }
  });

  fs.rmdirSync(dir);
};
