var fs = require('fs');

var init = exports.init = function(repoDir) {
  var gitDir = (repoDir || ".") + ".git/";
  var fileMode = "777";

  fs.mkdirSync(gitDir, fileMode);
};
