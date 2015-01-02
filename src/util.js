var util = module.exports = {
  isString: function(thing) {
    return typeof thing === "string";
  },

  hash: function(string) {
    var hashInt = 0;
    for (var i = 0; i < string.length; i++) {
      hashInt = hashInt * 31 + string.charCodeAt(i);
      hashInt = hashInt | 0;
    }

    return Math.abs(hashInt).toString(16);
  },

  assocIn: function(obj, arr) {
    if (arr.length === 2) {
      obj[arr[0]] = arr[1];
    } else if (arr.length > 2) {
      obj[arr[0]] = obj[arr[0]] || {};
      util.assocIn(obj[arr[0]], arr.slice(1));
    }

    return obj;
  },

  lines: function(str) {
    return str.split("\n").filter(function(l) { return l !== ''; });
  },

  flatten: function(arr) {
    return arr.reduce(function(a, e) {
      return a.concat(e instanceof Array ? util.flatten(e) : e);
    }, []);
  },

  unique: function(array) {
    return array.reduce(function(a, p) { return a.indexOf(p) === -1 ? a.concat(p) : a; }, []);
  },

  intersection: function(a, b) {
    return a.filter(function(e) { return b.indexOf(e) !== -1; });
  },

  remote: function(remoteUrl, fn) {
    return function() {
      var originalDir = process.cwd();
      process.chdir(remoteUrl);
      var result = fn.apply(null, arguments);
      process.chdir(originalDir);
      return result;
    };
  }
};
