var fs = require("fs");
var nodePath = require("path");
var merge = require("../src/merge");
var refs = require("../src/refs");
var objects = require("../src/objects");
var files = require("../src/files");
var index = require("../src/index");
var g = require("../src/gitlet");
var util = require("../src/util");
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
      .toThrow("not a Gitlet repository");
  });

  it("should throw if in bare repo", function() {
    g.init({ bare: true });
    expect(function() { g.merge(); })
      .toThrow("this operation must be run in a work tree");
  });

  describe('common ancestors', function() {
    it("should return hash if same hash passed", function() {
      g.init();
      createFlatFileStructure();
      g.add("filea");
      g.commit({ m: "first" });
      expect(merge.commonAncestor("281d2f1c", "281d2f1c")).toEqual("281d2f1c");
    });

    it("should return ancestor if one is descendent of other", function() {
      g.init();
      createFlatFileStructure();
      g.add("filea");
      g.commit({ m: "first" });
      g.add("fileb");
      g.commit({ m: "second" });
      expect(merge.commonAncestor("281d2f1c", "a9b6e7e")).toEqual("281d2f1c");
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

      expect(merge.commonAncestor("a9b6e7e", "281d2f1c")).toEqual("281d2f1c");
      expect(merge.commonAncestor("281d2f1c", "a9b6e7e")).toEqual("281d2f1c");
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

      expect(merge.commonAncestor("7ece7757", "47cf8efe")).toEqual("281d2f1c");
      expect(merge.commonAncestor("47cf8efe", "7ece7757")).toEqual("281d2f1c");
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

      expect(merge.commonAncestor("34503151", "1c67dfcf")).toEqual("7ece7757");
      expect(merge.commonAncestor("1c67dfcf", "34503151")).toEqual("7ece7757");
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

      addParent("2f31bde1", "571effba"); // 16 has another parent: 11
      addParent("7f7be135", "16b70b64"); // 15 has another parent: 12

      expect(merge.commonAncestor("2f31bde1", "7f7be135")).toEqual("571effba");
      expect(merge.commonAncestor("7f7be135", "2f31bde1")).toEqual("571effba");
    });
  });

  describe('merge', function() {
    describe('aborts', function() {
      it("should throw if can't resolve ref/hash passed", function() {
        g.init();
        expect(function() { g.merge("blah"); })
          .toThrow("blah: expected commit type");
      });

      it("should throw if try to merge when head detached", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add("1a/filea");
        g.commit({ m: "first" });
        g.add("1b/fileb");
        g.commit({ m: "second" });
        g.checkout("17a11ad4");

        expect(function() { g.merge("16b35712"); })
          .toThrow("unsupported");
      });

      it("should return up to date if one is descendent of other", function() {
        g.init();
        createFlatFileStructure();
        g.add("filea");
        g.commit({ m: "first" });
        g.add("fileb");
        g.commit({ m: "second" });

        expect(g.merge("281d2f1c")).toEqual("Already up-to-date");
      });

      it("should not throw if passed hash not descendent of HEAD, but HEAD descendent of passed hash", function() {
        g.init();
        createFlatFileStructure();
        g.add("filea");
        g.commit({ m: "first" });
        g.branch("other");
        g.add("fileb");
        g.commit({ m: "second" });

        expect(refs.hash("HEAD")).toEqual("a9b6e7e");
        expect(g.merge("281d2f1c")).toEqual("Already up-to-date");

        g.checkout("other");
        expect(refs.hash("HEAD")).toEqual("281d2f1c");
        expect(g.merge("a9b6e7e")).toNotEqual("Already up-to-date");
      });

      it("should return up to date if pass current HEAD hash", function() {
        g.init();
        createFlatFileStructure();
        g.add("filea");
        g.commit({ m: "first" });

        expect(g.merge("281d2f1c")).toEqual("Already up-to-date");
      });

      it("should throw if item to merge resolves, but is not commit", function() {
        g.init();
        createFlatFileStructure();
        g.add("filea");
        g.commit({ m: "first" });

        expect(function() { g.merge("5ceba65"); })
          .toThrow("5ceba65: expected commit type");
      });

      describe('working copy changes', function() {
        it("should throw if has unstaged changes wo common orig content w/ giver", function() {
          testUtil.createStandardFileStructure();
          g.init();

          g.add("1a/filea");
          g.commit({ m: "first" });

          g.branch("other");

          fs.writeFileSync("1a/filea", "fileachange1");
          g.add("1a/filea");
          g.commit({ m: "second" });
          g.checkout("other");

          fs.writeFileSync("1a/filea", "fileachange2");

          expect(function() { g.merge("master"); })
            .toThrow("local changes would be lost\n1a/filea\n");
        });

        it("should throw if file has changes even if make it same as giver", function() {
          testUtil.createStandardFileStructure();
          g.init();

          g.add("1a/filea");
          g.commit({ m: "first" });

          g.branch("other");

          fs.writeFileSync("1a/filea", "fileachange1");
          g.add("1a/filea");
          g.commit({ m: "second" });
          g.checkout("other");

          fs.writeFileSync("1a/filea", "fileachange1");

          expect(function() { g.merge("master"); })
            .toThrow("local changes would be lost\n1a/filea\n");
        });

        it("should throw if file has staged changes w/o common orig content with c/o", function() {
          testUtil.createStandardFileStructure();
          g.init();

          g.add("1a/filea");
          g.commit({ m: "first" });

          g.branch("other");

          fs.writeFileSync("1a/filea", "fileachange1");
          g.add("1a/filea");
          g.commit({ m: "second" });
          g.checkout("other");

          fs.writeFileSync("1a/filea", "fileachange2");
          g.add("1a/filea");

          expect(function() { g.merge("master"); })
            .toThrow("local changes would be lost\n1a/filea\n");
        });

        it("should list all files that would be overwritten when throwing", function() {
          testUtil.createStandardFileStructure();
          g.init();

          g.add("1a/filea");
          g.add("1b/fileb");
          g.add("1b/2b/filec");
          g.commit({ m: "first" });

          g.branch("other");

          fs.writeFileSync("1a/filea", "fileachange1");
          fs.writeFileSync("1b/fileb", "fileachange1");
          fs.writeFileSync("1b/2b/filec", "fileachange1");
          g.add("1a/filea");
          g.add("1b/fileb");
          g.add("1b/2b/filec");
          g.commit({ m: "second" });
          g.checkout("other");

          fs.writeFileSync("1a/filea", "fileachange2");
          fs.writeFileSync("1b/fileb", "fileachange2");
          fs.writeFileSync("1b/2b/filec", "fileachange2");

          expect(function() { g.merge("master"); })
            .toThrow("local changes would be lost\n1a/filea\n1b/fileb\n1b/2b/filec\n");
        });
      });
    });

    describe('fast forward', function() {
      it("should report that ancestor has been fast forwarded", function() {
        g.init();
        testUtil.createDeeplyNestedFileStructure();
        g.add("filea");
        g.commit({ m: "first" });
        g.branch("other");

        g.add("fileb");
        g.commit({ m: "second" });

        g.checkout("other");
        expect(g.merge("master")).toEqual("Fast-forward");
      });

      it("should set destination branch to merged commit", function() {
        g.init();
        testUtil.createDeeplyNestedFileStructure();
        g.add("filea");
        g.commit({ m: "first" });
        g.branch("other");
        expect(refs.hash("other")).toEqual("281d2f1c");

        g.add("fileb");
        g.commit({ m: "second" });
        var masterHash = refs.hash("master");
        expect(masterHash).toEqual("d08448d");

        g.checkout("other");
        g.merge("master");
        var otherHash = refs.hash("other");

        expect(masterHash).toEqual(otherHash);
      });

      it("should stay on branch after merge", function() {
        g.init();
        testUtil.createDeeplyNestedFileStructure();
        g.add("filea");
        g.commit({ m: "first" });
        g.branch("other");
        expect(refs.hash("other")).toEqual("281d2f1c");

        g.add("fileb");
        g.commit({ m: "second" });
        g.checkout("other");

        expect(g.merge("master")).toEqual("Fast-forward");
        expect(refs.headBranchName()).toEqual("other");
      });

      it("should update working copy after merge", function() {
        g.init();
        testUtil.createDeeplyNestedFileStructure();
        g.add("filea");
        g.commit({ m: "first" });
        g.branch("other");
        expect(refs.hash("other")).toEqual("281d2f1c");

        g.add("fileb");
        g.commit({ m: "second" });
        var masterHash = refs.hash("master");
        expect(masterHash).toEqual("d08448d");

        g.checkout("other");
        g.merge("master");

        testUtil.expectFile("filea", "filea");
        testUtil.expectFile("fileb", "fileb");
      });

      it("should update index after merge", function() {
        g.init();
        testUtil.createDeeplyNestedFileStructure();
        g.add("filea");
        g.commit({ m: "first" });
        g.branch("other");
        expect(refs.hash("other")).toEqual("281d2f1c");

        g.add("fileb");
        g.commit({ m: "second" });
        var masterHash = refs.hash("master");
        expect(masterHash).toEqual("d08448d");

        g.checkout("other");
        g.merge("master");

        testUtil.expectFile(".gitlet/index", "filea 0 5ceba65\nfileb 0 5ceba66\n");
      });

      it("should be able to fast foward a few commits", function() {
        g.init();
        testUtil.createDeeplyNestedFileStructure();
        g.add("filea");
        g.commit({ m: "first" });
        g.branch("other");
        expect(refs.hash("other")).toEqual("281d2f1c");

        g.add("fileb");
        g.commit({ m: "second" });
        g.add("c1/filec");
        g.commit({ m: "third" });
        g.add("d1/filed");
        g.commit({ m: "fourth" });
        g.add("e1/e2/filee");
        g.commit({ m: "fifth" });

        var masterHash = refs.hash("master");
        expect(masterHash).toEqual("4b3c6333");

        g.checkout("other");
        g.merge("master");
        var otherHash = refs.hash("other");

        expect(masterHash).toEqual(otherHash);
      });

      it("should not have created merge commit, so HEAD should have one parent", function() {
        g.init();
        testUtil.createDeeplyNestedFileStructure();
        g.add("filea");
        g.commit({ m: "first" });
        g.branch("other");

        g.add("fileb");
        g.commit({ m: "second" });

        g.checkout("other");
        g.merge("master");
        expect(objects.parentHashes(objects.read(refs.hash("HEAD"))).length).toEqual(1);
      });

      it("should be able to pass hash when fast-forwarding", function() {
        g.init();
        testUtil.createDeeplyNestedFileStructure();
        g.add("filea");
        g.commit({ m: "first" });
        g.branch("other");

        g.add("fileb");
        g.commit({ m: "second" });

        g.checkout("other");
        g.merge("d08448d");
        expect(refs.hash("HEAD")).toEqual("d08448d");
      });

      it("should be able to merge even if current branch has no commits", function() {
        var gl = g, gr = g;
        var localRepo = process.cwd();
        var remoteRepo = testUtil.makeRemoteRepo();

        gr.init();
        testUtil.createDeeplyNestedFileStructure();
        gr.add("filea");
        gr.commit({ m: "first" });

        process.chdir(localRepo);
        gl.init();
        gl.remote("add", "origin", remoteRepo);
        gl.fetch("origin");
        g.merge("refs/remotes/origin/master");
        expect(refs.hash("HEAD")).toEqual("281d2f1c");
      });
    });

    describe('three way merge', function() {
      describe('basic results', function() {
        beforeEach(function() {
          //      a
          //     / \
          //  M b  c
          //     \/
          //     m O

          g.init();
          testUtil.createDeeplyNestedFileStructure();
          g.add("filea");
          g.commit({ m: "a" });
          g.branch("other");

          g.add("fileb");
          g.commit({ m: "b" });

          g.checkout("other");
          g.add("c1/filec");
          g.commit({ m: "c" });
        });

        it("should give merge commit parents: head of cur branch, merged branch", function() {
          g.merge("master");

          var parentHashes = objects.parentHashes(objects.read(refs.hash("HEAD")));
          expect(parentHashes[0]).toEqual("4c37d74c");
          expect(parentHashes[1]).toEqual("505952f0");
        });

        it("should point HEAD at merge commit", function() {
          g.merge("master");
          expect(refs.hash("HEAD")).toEqual("3cc84b4c");
        });

        it("should point branch at merge commit", function() {
          g.merge("master");
          expect(refs.hash("other")).toEqual("3cc84b4c");
        });

        it("should stay on branch after merge", function() {
          g.merge("master");
          expect(refs.headBranchName()).toEqual("other");
        });

        it("should return string describing merge strategy", function() {
          expect(g.merge("master")).toEqual("Merge made by the three-way strategy");
        });

        it("should allow merging of hash", function() {
          g.merge("505952f0");
          expect(refs.hash("HEAD")).toEqual("7b1641d0");
        });

        it("should say hash was merged in commit message", function() {
          g.merge("505952f0");

          var commitStrLines = objects.read(refs.hash("HEAD")).split("\n");
          expect(commitStrLines[commitStrLines.length - 2])
            .toEqual("    Merge 505952f0 into other");
        });

        it("should say branch was merged in commit message", function() {
          g.merge("master");

          var commitStrLines = objects.read(refs.hash("HEAD")).split("\n");
          expect(commitStrLines[commitStrLines.length - 2])
            .toEqual("    Merge master into other");
        });

        it("should remove MERGE_MSG after committing merge", function() {
          g.merge("master");
          expect(fs.existsSync(files.gitletPath("MERGE_MSG"))).toEqual(false);
        });

        it("should remove MERGE_HEAD after committing merge", function() {
          g.merge("master");
          expect(fs.existsSync(files.gitletPath("MERGE_HEAD"))).toEqual(false);
        });
      });

      describe('rm', function() {
        it("should merge in rm of file", function() {
          //      a
          //     / \
          // M rma  b
          //     \/
          //     m O    files: b

          g.init();
          testUtil.createDeeplyNestedFileStructure();
          g.add("filea");
          g.commit({ m: "a" });
          g.branch("other");

          g.rm("filea");
          g.commit({ m: "rma" });

          g.checkout("other");
          g.add("fileb");
          g.commit({ m: "b" });

          g.merge("master");

          expect(testUtil.index().length).toEqual(1);
          expect(testUtil.index()[0].path).toEqual("fileb");

          expect(fs.existsSync("filea")).toEqual(false);
          expect(fs.existsSync("c1/filec")).toEqual(true); // sanity
          testUtil.expectFile("fileb", "fileb");

          var toc = objects.commitToc(refs.hash("HEAD"));
          expect(Object.keys(toc).length).toEqual(1);
          expect(toc["fileb"]).toBeDefined();
        });
      });

      describe('add', function() {
        it("should merge in addition of file", function() {
          //      a
          //     / \
          // M  b  c
          //     \/
          //     m O    files: a, b, c

          g.init();
          testUtil.createDeeplyNestedFileStructure();
          g.add("filea");
          g.commit({ m: "a" });
          g.branch("other");

          g.add("fileb");
          g.commit({ m: "b" });

          g.checkout("other");
          g.add("c1/filec");
          g.commit({ m: "c" });

          g.merge("master");

          expect(testUtil.index().length).toEqual(3);
          expect(testUtil.index()[0].path).toEqual("filea");
          expect(testUtil.index()[1].path).toEqual("c1/filec");
          expect(testUtil.index()[2].path).toEqual("fileb");

          testUtil.expectFile("filea", "filea");
          testUtil.expectFile("fileb", "fileb");
          testUtil.expectFile("c1/filec", "filec");

          var toc = objects.commitToc(refs.hash("HEAD"));
          expect(Object.keys(toc).length).toEqual(3);
          expect(toc["filea"]).toBeDefined();
          expect(toc["fileb"]).toBeDefined();
          expect(toc["c1/filec"]).toBeDefined();
        });
      });

      describe('non-conflicting modify', function() {
        it("should merge in file change", function() {
          //       a
          //     /    \
          // M mod-aa  add-b
          //      \   /
          //       m O    files: aa, b

          g.init();
          testUtil.createDeeplyNestedFileStructure();
          g.add("filea");
          g.commit({ m: "a" });
          g.branch("other");

          fs.writeFileSync("filea", "fileaa");
          g.add("filea");
          g.commit({ m: "aa" });

          g.checkout("other");

          g.add("fileb");
          g.commit({ m: "b" });

          g.merge("master");

          expect(testUtil.index().length).toEqual(2);
          expect(testUtil.index()[0].path).toEqual("filea");
          expect(testUtil.index()[1].path).toEqual("fileb");

          testUtil.expectFile("filea", "fileaa");
          testUtil.expectFile("fileb", "fileb");

          var toc = objects.commitToc(refs.hash("HEAD"));
          expect(Object.keys(toc).length).toEqual(2);
          expect(toc["filea"]).toBeDefined();
          expect(toc["fileb"]).toBeDefined();
        });
      });

      describe('conflict', function() {
        beforeEach(function() {
          //       a
          //       |
          //       aa
          //      /  \
          // M aaa   aaaa
          //     \   /
          //       m      O <<<aaaa===aaa>>>

          g.init();
          testUtil.createDeeplyNestedFileStructure();
          g.add("filea");
          g.commit({ m: "a" });

          fs.writeFileSync("filea", "fileaa");
          g.add("filea");
          g.commit({ m: "aa" });

          g.branch("other");

          fs.writeFileSync("filea", "fileaaa");
          g.add("filea");
          g.commit({ m: "aaa" });

          g.checkout("other");

          fs.writeFileSync("filea", "fileaaaa");
          g.add("filea");
          g.commit({ m: "aaaa" });
        });

        describe('writing conflict', function() {
          it("should report there is a conflict when merging", function() {
            expect(g.merge("master"))
              .toEqual("Automatic merge failed. Fix conflicts and commit the result.");
          });

          it("should write index indicating conflicts", function() {
            g.merge("master");

            expect(testUtil.index().length).toEqual(3);

            expect(testUtil.index()[0].path).toEqual("filea");
            expect(testUtil.index()[0].stage).toEqual(1);
            expect(objects.read(testUtil.index()[0].hash)).toEqual("fileaa");

            expect(testUtil.index()[1].path).toEqual("filea");
            expect(testUtil.index()[1].stage).toEqual(2);
            expect(objects.read(testUtil.index()[1].hash)).toEqual("fileaaaa");

            expect(testUtil.index()[2].path).toEqual("filea");
            expect(testUtil.index()[2].stage).toEqual(3);
            expect(objects.read(testUtil.index()[2].hash)).toEqual("fileaaa");
          });

          it("should write conflict to working copy", function() {
            g.merge("master");

            testUtil.expectFile("filea", "<<<<<<\nfileaaaa\n======\nfileaaa\n>>>>>>\n");
          });

          it("should still have merge head when conflict happens", function() {
            g.merge("master");

            testUtil.expectFile(files.gitletPath("MERGE_HEAD"), "1dd535ea");
          });
        });

        describe("committing with unresolved conflict", function() {
          it("should mention conflicted file", function() {
            g.merge("master");
            testUtil.expectFile(files.gitletPath("MERGE_HEAD"), "1dd535ea"); // sanity: merging

            expect(function() { g.commit(); })
              .toThrow("U filea\ncannot commit because you have unmerged files\n");
          });

          it("should leave repo in merging stage", function() {
            g.merge("master");
            testUtil.expectFile(files.gitletPath("MERGE_HEAD"), "1dd535ea"); // sanity: merging

            expect(function() { g.commit(); }).toThrow();
            testUtil.expectFile(files.gitletPath("MERGE_HEAD"), "1dd535ea");
          });
        });

        describe("committing a resolved conflict", function() {
          it("should say that merge happened", function() {
            g.merge("master");
            testUtil.expectFile(files.gitletPath("MERGE_HEAD"), "1dd535ea"); // sanity: merging

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            expect(g.commit()).toEqual("Merge made by the three-way strategy");
          });

          it("should not be merging after commit", function() {
            g.merge("master");

            expect(fs.existsSync(nodePath.join(files.gitletPath(), "MERGE_HEAD")))
              .toEqual(true);

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            g.commit();

            expect(fs.existsSync(nodePath.join(files.gitletPath(), "MERGE_HEAD")))
              .toEqual(false);
          });

          it("should remove MERGE_MSG after commit", function() {
            g.merge("master");

            expect(fs.existsSync(nodePath.join(files.gitletPath(), "MERGE_MSG")))
              .toEqual(true);

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            g.commit();

            expect(fs.existsSync(nodePath.join(files.gitletPath(), "MERGE_MSG")))
              .toEqual(false);
          });

          it("should update index with merge", function() {
            g.merge("master");
            testUtil.expectFile(files.gitletPath("MERGE_HEAD"), "1dd535ea"); // sanity: merging

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            g.commit();

            expect(testUtil.index().length).toEqual(1);
            expect(testUtil.index()[0].path).toEqual("filea");
          });

          it("should leave WC file as it was committed", function() {
            g.merge("master");
            testUtil.expectFile(files.gitletPath("MERGE_HEAD"), "1dd535ea"); // sanity: merging

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            g.commit();

            testUtil.expectFile("filea", "fileaaa");
          });

          it("should commit merge commit with merged content", function() {
            g.merge("master");
            testUtil.expectFile(files.gitletPath("MERGE_HEAD"), "1dd535ea"); // sanity: merging

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            g.commit();

            var toc = objects.commitToc(refs.hash("HEAD"));
            expect(Object.keys(toc).length).toEqual(1);
            expect(toc["filea"]).toEqual(util.hash("fileaaa"));
          });

          it("should leave head pointed at current branch", function() {
            g.merge("master");
            testUtil.expectFile(files.gitletPath("MERGE_HEAD"), "1dd535ea"); // sanity: merging

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            g.commit();

            expect(refs.terminalRef("HEAD")).toEqual("refs/heads/other");
          });
        });
      });
    });
  });
});
