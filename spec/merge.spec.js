var fs = require("fs");
var nodePath = require("path");
var g = require("../src/gitlet");
var merge = require("../src/merge");
var testUtil = require("./test-util");

function spToUnd(charr) {
  return charr === "_" ? undefined : charr;
};

function createFlatFileStructure() {
  testUtil.createFilesFromTree({ filea: "filea",
                                 fileb: "filea",
                                 filec: "filea",
                                 filed: "filea",
                                 filee: "filea",
                                 filef: "filea",
                                 fileg: "filea",
                                 fileh: "filea" });
};

describe("merge", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.merge(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  describe('longest common subsequence', function() {
    it("should say HMAN for HUMAN and CHIMPANZEE", function() {
      var a =   "HUMAN".split("");
      var b =   "CHIMPANZEE".split("");
      var exp = "HMAN".split("");
      expect(merge.longestCommonSubsequence(a, b)).toEqual(exp);
    });

    it("should say mfe for mjfe and mfeb", function() {
      var a =   "mjfe".split("");
      var b =   "mfeb".split("");
      var exp = "mfe".split("");
      expect(merge.longestCommonSubsequence(a, b)).toEqual(exp);
    });

    it("should say mfe for mfeb and mfseb", function() {
      var a =   "mfeb".split("");
      var b =   "mfseb".split("");
      var exp = "mfeb".split("");
      expect(merge.longestCommonSubsequence(a, b)).toEqual(exp);
    });

    it("should say tsitest for thisisatest and testing123testing", function() {
      var a =   "thisisatest".split("");
      var b =   "testing123testing".split("");
      var exp = "tsitest".split("");
      expect(merge.longestCommonSubsequence(a, b)).toEqual(exp);
    });
  });

  describe('longest common subsequence alignment', function() {
    it("should work for sequences that don't start w the same character", function() {
      var a =   "HUMAN".split("");
      var b =   "CHIMPANZEE".split("");
      var exp = { a: "_HUM_AN___".split("").map(spToUnd),
                  b: "CHIMPANZEE".split("").map(spToUnd) };
      expect(merge.align(a, b)).toEqual(exp);
    });

    it("should work for first part of milk flour eggs example", function() {
      var a =   "mjfe".split("");
      var b =   "mfeb".split("");
      var exp = { a: "mjfe_".split("").map(spToUnd),
                  b: "m_feb".split("").map(spToUnd) };
      expect(merge.align(a, b)).toEqual(exp);
    });

    it("should work for second part of milk flour eggs example", function() {
      var a =   "mfeb".split("");
      var b =   "mfseb".split("");
      var exp = { a: "mf_eb".split("").map(spToUnd),
                  b: "mfseb".split("").map(spToUnd) };
      expect(merge.align(a, b)).toEqual(exp);
    });

    it("should work for rosetta code example 1", function() {
      var a =   "1234".split("");
      var b =   "1224533324".split("");
      var exp = { a: "12___3___4".split("").map(spToUnd),
                  b: "1224533324".split("").map(spToUnd) };
      expect(merge.align(a, b)).toEqual(exp);
    });

    it("should work for rosetta code example 2", function() {
      var a =   "thisisatest".split("");
      var b =   "testing123testing".split("");
      var exp = { a: "this_isa___test___".split("").map(spToUnd),
                  b: "te_sting123testing".split("").map(spToUnd) };
      expect(merge.align(a, b)).toEqual(exp);
    });

    it("should work for example of arrays of actual lines", function() {
      var a = ["milk", "flour", "eggs", "butter"];
      var b = ["milk", "flour", "sausage", "eggs", "butter"];;
      var exp = { a: ["milk", "flour", undefined, "eggs", "butter"],
                  b: ["milk", "flour", "sausage", "eggs", "butter"] };
      expect(merge.align(a, b)).toEqual(exp);
    });
  });

  describe('common ancestors', function() {
    it("should return hash if same hash passed", function() {
      g.init();
      createFlatFileStructure();
      g.add("filea");
      g.commit({ m: "first" });
      expect(merge.readCommonAncestor("98d541a", "98d541a")).toEqual("98d541a");
    });

    it("should return ancestor if one is descendent of other", function() {
      g.init();
      createFlatFileStructure();
      g.add("filea");
      g.commit({ m: "first" });
      g.add("fileb");
      g.commit({ m: "second" });
      expect(merge.readCommonAncestor("98d541a", "5b89af33")).toEqual("98d541a");
    });

    it("should return branch point for master and branch both w one extra commit", function() {
      g.init();
      createFlatFileStructure();
      g.add("filea");
      g.commit({ m: "first" });
      g.branch("other");

      g.add("fileb");
      g.commit({ m: "second" });

      g.checkout("other");
      g.add("filec");
      g.commit({ m: "third" });

      expect(merge.readCommonAncestor("5b89af33", "22a17392")).toEqual("98d541a");
      expect(merge.readCommonAncestor("22a17392", "5b89af33")).toEqual("98d541a");
    });

    it("should return branch point for master and branch both w two extra commits", function() {
      g.init();
      createFlatFileStructure();
      g.add("filea");
      g.commit({ m: "first" });
      g.branch("other");

      g.add("fileb");
      g.commit({ m: "second" });
      g.add("filec");
      g.commit({ m: "third" });

      g.checkout("other");
      g.add("filed");
      g.commit({ m: "fourth" });
      g.add("filee");
      g.commit({ m: "fifth" });

      expect(merge.readCommonAncestor("47bd0fa3", "116a5202")).toEqual("98d541a");
      expect(merge.readCommonAncestor("116a5202", "47bd0fa3")).toEqual("98d541a");
    });

    it("should return most recent ancestor if there is a shared hist of several commits", function() {
      g.init();
      createFlatFileStructure();
      g.add("filea");
      g.commit({ m: "first" });
      g.add("fileb");
      g.commit({ m: "second" });
      g.add("filec");
      g.commit({ m: "third" });
      g.branch("other");

      g.add("filed");
      g.commit({ m: "fourth" });

      g.checkout("other");
      g.add("filee");
      g.commit({ m: "fifth" });

      expect(merge.readCommonAncestor("4dc3d2e0", "6391e16f")).toEqual("47bd0fa3");
      expect(merge.readCommonAncestor("6391e16f", "4dc3d2e0")).toEqual("47bd0fa3");
    });

    it("should return a single ancestor if merge commits have multiple common ancestors", function() {
      // (it's basically arbitrary which of the possible ancestors is returned)

      // example here: http://codicesoftware.blogspot.com/2011/09/merge-recursive-strategy.html
      // real git uses recursive strategy to merge multiple ancestors into a final common ancestor.
      // I am not going to implement this for now

      g.init();
      createFlatFileStructure();
      g.add("filea");
      g.commit({ m: "10" });
      g.branch("task001");

      g.add("fileb");
      g.commit({ m: "11" });

      g.checkout("task001");
      g.add("filec");
      g.commit({ m: "12" });

      g.checkout("master");
      g.add("filed");
      g.commit({ m: "13" });

      g.checkout("task001");
      g.add("filee");
      g.commit({ m: "14" });

      g.checkout("master");
      g.add("filef");
      g.commit({ m: "15" });

      g.checkout("task001");
      g.add("fileg");
      g.commit({ m: "16" });

      // TODO: once merge implemented change these fake merges into calls to merge()

      function addParent(commitHash, parentHash) {
        var path = ".gitlet/objects/" + commitHash;
        var lines = fs.readFileSync(path, "utf8").split("\n");
        var out = lines.slice(0, 2)
            .concat("parent " + parentHash)
            .concat(lines.slice(2))
            .join("\n") + "\n";
        fs.writeFileSync(path, out);
      };

      addParent("234b5b00", "3e8447ee"); // 16 has another parent: 11
      addParent("71fd6f26", "5ca1d0c7"); // 15 has another parent: 12

      expect(merge.readCommonAncestor("234b5b00", "71fd6f26")).toEqual("3e8447ee");
      expect(merge.readCommonAncestor("71fd6f26", "234b5b00")).toEqual("3e8447ee");
    });
  });

  ddescribe('merging', function() {
    it("should throw if can't resolve ref/hash passed", function() {
      g.init();
      expect(function() { g.merge("blah"); })
        .toThrow("merge: blah - not something we can merge");
    });

    it("should throw if try to merge when head detached", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      g.add("1b/fileb");
      g.commit({ m: "second" });
      g.checkout("21cb63f6");

      expect(function() { g.merge("1c4100dd"); })
        .toThrow("unsupported");
    });
  });
});

// test that merge says already up to date if one commit is ancestor of other - it's
//   if branch to merge appears in parents list of current commit - not commutative
