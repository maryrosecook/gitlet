var parseOptions = module.exports = function(argv) {
  var name;
  return argv.reduce(function(opts, arg) {
    if (name !== undefined) {
      opts[name] = arg;
      name = undefined;
    } else if (arg.match("^-")) {
      name = arg.replace(/-/g, "");
      opts[name] = true;
    } else {
      opts._.push(arg);
    }

    return opts;
  }, { _: [] });
};
