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
  },

  lines: function(str) {
    return str.split("\n").slice(0, -1); // last is empty
  }
};
