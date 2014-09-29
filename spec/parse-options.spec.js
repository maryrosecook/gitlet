var p = require('../parse-options');

describe('parse-options', function() {
  it('should set short option to true if no value', function() {
    expect(p(["-m"])).toEqual({ _: [], m: true });
  });

  it('should set long option to true if no value', function() {
    expect(p(["--message"])).toEqual({ _: [], message: true });
  });

  it('should parse short option with value', function() {
    expect(p(["-m", "blah"])).toEqual({ _: [], m: 'blah' });
  });

  it('should parse long option with value', function() {
    expect(p(["--message", "blah"])).toEqual({ _: [], message: 'blah' });
  });

  it('should parse string and short option with value', function() {
    expect(p(["command", "-m", "blah"])).toEqual({ _: ["command"], m: 'blah' });
  });

  it('should parse string and long option with value', function() {
    expect(p(["command", "--message", "blah"])).toEqual({ _: ["command"], message: 'blah' });
  });

  it('should parse three strings in right order', function() {
    expect(p(["command1", "command2", "command3"]))
      .toEqual({ _: ["command1", "command2", "command3"] });
  });

  it('should parse string, short option with value, string', function() {
    expect(p(["command1", "-m", "blah", "command2"]))
      .toEqual({ _: ["command1", "command2"], m: "blah" });
  });

  it('should parse string, long option with value, string', function() {
    expect(p(["command1", "--message", "blah", "command2"]))
      .toEqual({ _: ["command1", "command2"], message: "blah" });
  });

  it('should parse string with dash in it long option with value', function() {
    expect(p(["command-1", "--message", "blah"]))
      .toEqual({ _: ["command-1"], message: "blah" });
  });

  it('should parse option with dash in the middle', function() {
    expect(p(["command", "--name-status"]))
      .toEqual({ _: ["command"], "name-status": true });
  });

  it('should parse two long opts that do not have values', function() {
    expect(p(["command", "--flag1", "--flag2"]))
      .toEqual({ _: ["command"], flag1: true, flag2: true });
  });

  it('should parse long opt without value and long opt with value', function() {
    expect(p(["command", "--flag1", "--flag2", "woo"]))
      .toEqual({ _: ["command"], flag1: true, flag2: "woo" });
  });

  it('should parse long opt with value and long opt with value', function() {
    expect(p(["command", "--flag1", "--flag2", "woo"]))
      .toEqual({ _: ["command"], flag1: true, flag2: "woo" });
  });

  describe('gitlet commands', function() {
    it('should parse "node gitlet.js add a/b.js"', function() {
      expect(p(["node", "gitlet.js", "add", "a/b.js"]))
        .toEqual({ _: ["node", "gitlet.js", "add", "a/b.js"] });
    });

    it('should parse "node gitlet.js init"', function() {
      expect(p(["node", "gitlet.js", "init"]))
        .toEqual({ _: ["node", "gitlet.js", "init"] });
    });

    it('should parse "node gitlet.js update-index a/b.js"', function() {
      expect(p(["node", "gitlet.js", "update-index", "a/b.js"]))
        .toEqual({ _: ["node", "gitlet.js", "update-index", "a/b.js"] });
    });

    it('should parse "node gitlet.js update-index a/b.js --add"', function() {
      expect(p(["node", "gitlet.js", "update-index", "a/b.js", "--add"]))
        .toEqual({ _: ["node", "gitlet.js", "update-index", "a/b.js"], add: true });
    });

    it('should parse "node gitlet.js hash-object a/b.js -w"', function() {
      expect(p(["node", "gitlet.js", "hash-object", "a/b.js", "-w"]))
        .toEqual({ _: ["node", "gitlet.js", "hash-object", "a/b.js"], w: true });
    });

    it('should parse "node gitlet.js commit -m "blah""', function() {
      expect(p(["node", "gitlet.js", "commit", "-m", "blah"]))
        .toEqual({ _: ["node", "gitlet.js", "commit"], m: "blah" });
    });

    it('should parse "node gitlet.js update-ref HEAD 21thuntoonet"', function() {
      expect(p(["node", "gitlet.js", "update-ref", "HEAD", "21thuntoonet"]))
        .toEqual({ _: ["node", "gitlet.js", "update-ref", "HEAD", "21thuntoonet"] });
    });
  });
});
