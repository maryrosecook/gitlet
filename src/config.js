var files = require("./files");
var util = require("./util");

var config = module.exports = {
  readIsBare: function() {
    return config.read().core[""].bare === "true";
  },

  assertNotBare: function() {
    if (config.readIsBare()) {
      throw new Error("error: this operation must be run in a work tree");
    }
  },

  read: function() {
    return config.strToObj(files.read(files.gitletPath("config")));
  },

  write: function(configObj) {
    files.write(files.gitletPath("config"), config.objToStr(configObj));
  },

  strToObj: function(str) {
    return str.split("[")
      .map(function(item) { return item.trim(); })
      .filter(function(item) { return item !== ""; })
      .reduce(function(c, item) {
        var lines = item.split("\n");
        var entry = [];

        // section eg "branch" or "core"
        entry.push(lines[0].match(/([^ \]]+)( |\])/)[1]);

        // eg "master"
        var subsectionMatch = lines[0].match(/\"(.+)\"/);
        var subsection = subsectionMatch === null ? "" : subsectionMatch[1];
        entry.push(subsection);

        // options and their values
        entry.push(lines.slice(1).reduce(function(s, l) {
          s[l.split("=")[0].trim()] = l.split("=")[1].trim();
          return s;
        }, {}));

        return util.assocIn(c, entry);
      }, { "remote": {}, "branch": {} });
  },

  objToStr: function(configObj) {
    return Object.keys(configObj)
      .reduce(function(arr, section) {
        return arr.concat(
          Object.keys(configObj[section])
            .map(function(subsection) { return { section: section, subsection: subsection }})
        );
      }, [])
      .map(function(entry) {
        var subsection = entry.subsection === "" ? "" : " \"" + entry.subsection +"\"";
        var settings = configObj[entry.section][entry.subsection];
        return "[" + entry.section + subsection + "]\n" +
          Object.keys(settings)
          .map(function(k) { return "  " + k + " = " + settings[k]; })
          .join("\n") + "\n";
      })
      .join("");
  }
};
