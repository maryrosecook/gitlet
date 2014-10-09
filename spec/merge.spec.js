var fs = require("fs");
var nodePath = require("path");
var g = require("../src/gitlet");
var merge = require("../src/merge");
var testUtil = require("./test-util");

function spToUnd(charr) {
  return charr === "_" ? undefined : charr;
};

ddescribe("merge", function() {
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
});
