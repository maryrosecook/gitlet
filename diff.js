var objects = require('./objects');

var diff = module.exports = {
  readIsDiffableRef: function(ref) {
    return ref !== undefined && objects.readExists(ref);
  }
};
