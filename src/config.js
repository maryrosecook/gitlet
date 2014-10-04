var fs = require("fs");
var nodePath = require("path");
var files = require("./files");

var config = module.exports = {
  read: function() {
    files.read()
  }
};

function readConfigContent() {
  return files.read();
};
