var parseOptions = module.exports = function(argv) {
  var name;
  return argv.reduce(function(opts, arg) {
    if (arg.match("^-")) {
      name = arg.replace(/^-+/, "");
      opts[name] = true;
    } else if (name !== undefined) {
      opts[name] = arg;
      name = undefined;
    } else {
      opts._.push(arg);
    }

    return opts;
  }, { _: [] });
};
