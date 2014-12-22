var files = require("./files");
var util = require("./util");

var config = module.exports = {
  read: function() {
    var content = files.read(files.gitletPath("config"));
    var l = content.split("[")
      .map(function(item) { return item.trim(); })
      .filter(function(item) { return item !== ""; })
      .reduce(function(c, item) {
        var lines = item.split("\n");
        var entry = [];

        // category eg "branch" or "core"
        entry.push(lines[0].match(/([^ \]]+)( |\])/)[1]);

        var nameMatch = lines[0].match(/\"(.+)\"/);
        if (nameMatch !== null) {
          entry.push(nameMatch[1]); // eg "master"
        }

        // options and their values
        entry.push(lines.slice(1).reduce(function(s, l) {
          s[l.split("=")[0].trim()] = l.split("=")[1].trim();
          return s;
        }, {}));

        return util.assocIn(c, entry);
      }, { "remote": {}, "branch": {} });

    return l;
  },

  write: function(configObj) {
    var configStr = Object.keys(configObj)
        .reduce(function(arr, category) {
          return arr.concat(
            Object.keys(configObj[category])
              .map(function(name) { return { name: name, category: category }})
          );
        }, [])
        .map(function(entry) {
          var settings = configObj[entry.category][entry.name];
          return "[" + entry.category + " " + "\"" + entry.name + "\"]\n" +
            Object.keys(settings)
            .map(function(k) { return "  " + k + " = " + settings[k]; })
            .join("\n") + "\n";
        })
        .join("") + "\n";

    files.write(files.gitletPath("config"), configStr);
  }
};
