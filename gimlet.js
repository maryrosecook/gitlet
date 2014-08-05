var fs = require('fs');

var init = exports.init = function(repoDir) {
  var gitDir = (repoDir || ".") + "/.git";
  fs.mkdirSync(gitDir);
};
