// var diff = require("./diff");
var refs = require("./refs");

var status = module.exports = {
  toString: function() {
    return status.readCurrentBranch().join("\n");
  },

  readCurrentBranch: function() {
    return ["On branch " + refs.readHeadBranchName()];
  }
};
