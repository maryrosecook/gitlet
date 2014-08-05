var fs = require('fs');

var init = exports.init = function(repoDir) {
  fs.mkdirSync(gitDir);
  var gitDir = (repoDir || ".") + ".git/";
};
