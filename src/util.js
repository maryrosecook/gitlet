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
    return str.split("\n").slice(0, -1); // last is empty
  },

  flatten: function(arr) {
    return arr.reduce(function(a, e) {
      return a.concat(e instanceof Array ? util.flatten(e) : e);
    }, []);
  },

  difference: function(a, b) {
    return a.filter(function(e) { return b.indexOf(e) === -1; });
  },

  // assumes args to fn have unique toString
  memoize: function(fn) {
    var cache = {};
    return function() {
      var key = Array.prototype.slice.apply(arguments)
          .map(function(a) { return a.toString(); }).join(",");
      if (cache[key] !== undefined) {
        return cache[key];
      } else {
        cache[key] = fn.apply(null, arguments);
        return cache[key];
      }
    }
  }
};
