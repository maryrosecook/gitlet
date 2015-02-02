var fs = require("fs");
var p = require("path");
var g = require("../gitlet");
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

  describe("merge", function() {
    describe("aborts", function() {
      it("should throw if can't resolve ref/hash passed", function() {
        g.init();
        expect(function() { g.merge("blah"); })
          .toThrow("blah: expected commit type");
      });

      it("should throw if try to merge when head detached", function() {
        testUtil.createStandardFileStructure();
        g.init();
        g.add(p.normalize("1a/filea"));
        g.commit({ m: "first" });
        g.add(p.normalize("1b/fileb"));
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

        expect(testUtil.headHash()).toEqual("a9b6e7e");
        expect(g.merge("281d2f1c")).toEqual("Already up-to-date");

        g.checkout("other");
        expect(testUtil.headHash()).toEqual("281d2f1c");
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

      describe("working copy changes", function() {
        it("should throw if has unstaged changes wo common orig content w/ giver", function() {
          testUtil.createStandardFileStructure();
          g.init();

          g.add(p.normalize("1a/filea"));
          g.commit({ m: "first" });

          g.branch("other");

          fs.writeFileSync("1a/filea", "fileachange1");
          g.add(p.normalize("1a/filea"));
          g.commit({ m: "second" });
          g.checkout("other");

          fs.writeFileSync("1a/filea", "fileachange2");

          expect(function() { g.merge("master"); })
            .toThrow("local changes would be lost\n" + p.normalize("1a/filea") + "\n");
        });

        it("should throw if file has changes even if make it same as giver", function() {
          testUtil.createStandardFileStructure();
          g.init();

          g.add(p.normalize("1a/filea"));
          g.commit({ m: "first" });

          g.branch("other");

          fs.writeFileSync("1a/filea", "fileachange1");
          g.add(p.normalize("1a/filea"));
          g.commit({ m: "second" });
          g.checkout("other");

          fs.writeFileSync("1a/filea", "fileachange1");

          expect(function() { g.merge("master"); })
            .toThrow("local changes would be lost\n" + p.normalize("1a/filea") + "\n");
        });

        it("should throw if file has staged changes w/o common orig content with c/o", function() {
          testUtil.createStandardFileStructure();
          g.init();

          g.add(p.normalize("1a/filea"));
          g.commit({ m: "first" });

          g.branch("other");

          fs.writeFileSync("1a/filea", "fileachange1");
          g.add(p.normalize("1a/filea"));
          g.commit({ m: "second" });
          g.checkout("other");

          fs.writeFileSync("1a/filea", "fileachange2");
          g.add("1a/filea");

          expect(function() { g.merge("master"); })
            .toThrow("local changes would be lost\n" + p.normalize("1a/filea") + "\n");
        });

        it("should list all files that would be overwritten when throwing", function() {
          testUtil.createStandardFileStructure();
          g.init();

          g.add(p.normalize("1a/filea"));
          g.add(p.normalize("1b/fileb"));
          g.add(p.normalize("1b/2b/filec"));
          g.commit({ m: "first" });

          g.branch("other");

          fs.writeFileSync("1a/filea", "fileachange1");
          fs.writeFileSync("1b/fileb", "fileachange1");
          fs.writeFileSync("1b/2b/filec", "fileachange1");
          g.add(p.normalize("1a/filea"));
          g.add(p.normalize("1b/fileb"));
          g.add(p.normalize("1b/2b/filec"));
          g.commit({ m: "second" });
          g.checkout("other");

          fs.writeFileSync("1a/filea", "fileachange2");
          fs.writeFileSync("1b/fileb", "fileachange2");
          fs.writeFileSync("1b/2b/filec", "fileachange2");

          expect(function() { g.merge("master"); })
            .toThrow("local changes would be lost\n" + p.normalize("1a/filea") + "\n" + p.normalize("1b/fileb") + "\n" + p.normalize("1b/2b/filec") + "\n");
        });
      });
    });

    describe("fast forward", function() {
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

        g.add("fileb");
        g.commit({ m: "second" });
        var masterHash = testUtil.refHash("refs/heads/master");
        expect(masterHash).toEqual("d08448d");

        g.checkout("other");
        g.merge("master");
        var otherHash = testUtil.refHash("refs/heads/other");

        expect(masterHash).toEqual(otherHash);
      });

      it("should stay on branch after merge", function() {
        g.init();
        testUtil.createDeeplyNestedFileStructure();
        g.add("filea");
        g.commit({ m: "first" });
        g.branch("other");
        expect(testUtil.refHash("refs/heads/other")).toEqual("281d2f1c");

        g.add("fileb");
        g.commit({ m: "second" });
        g.checkout("other");

        expect(g.merge("master")).toEqual("Fast-forward");
        testUtil.expectFile(".gitlet/HEAD", "ref: refs/heads/other");
      });

      it("should update working copy after merge", function() {
        g.init();
        testUtil.createDeeplyNestedFileStructure();
        g.add("filea");
        g.commit({ m: "first" });
        g.branch("other");
        expect(testUtil.refHash("refs/heads/other")).toEqual("281d2f1c");

        g.add("fileb");
        g.commit({ m: "second" });
        var masterHash = testUtil.refHash("refs/heads/master");
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
        expect(testUtil.refHash("refs/heads/other")).toEqual("281d2f1c");

        g.add("fileb");
        g.commit({ m: "second" });
        var masterHash = testUtil.refHash("refs/heads/master");
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
        expect(testUtil.refHash("refs/heads/other")).toEqual("281d2f1c");

        g.add("fileb");
        g.commit({ m: "second" });
        g.add(p.normalize("c1/filec"));
        g.commit({ m: "third" });
        g.add(p.normalize("d1/filed"));
        g.commit({ m: "fourth" });
        g.add(p.normalize("e1/e2/filee"));
        g.commit({ m: "fifth" });

        var masterHash = testUtil.refHash("refs/heads/master");
        expect(masterHash).toEqual("4b3c6333");

        g.checkout("other");
        g.merge("master");
        var otherHash = testUtil.refHash("refs/heads/other");

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

        var commitStr = testUtil.readFile(".gitlet/objects/" + testUtil.headHash());
        expect(commitStr
               .split("\n")
               .filter(function(line) { return line.match(/^parent/); }).length)
          .toEqual(1);
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
        expect(testUtil.headHash()).toEqual("d08448d");
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
        gl.fetch("origin", "master");
        g.merge("refs/remotes/origin/master");
        expect(testUtil.headHash()).toEqual("281d2f1c");
      });
    });

    describe("three way merge", function() {
      describe("basic results", function() {
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
          g.add(p.normalize("c1/filec"));
          g.commit({ m: "c" });
        });

        it("should give merge commit parents: head of cur branch, merged branch", function() {
          g.merge("master");

          var commitStr = testUtil.readFile(".gitlet/objects/" + testUtil.headHash());
          var parentLines = commitStr
              .split("\n")
              .filter(function(line) { return line.match(/^parent/); });

          expect(parentLines[0]).toEqual("parent 4c37d74c");
          expect(parentLines[1]).toEqual("parent 505952f0");
        });

        it("should point HEAD at merge commit", function() {
          g.merge("master");
          expect(testUtil.headHash()).toEqual("3cc84b4c");
        });

        it("should point branch at merge commit", function() {
          g.merge("master");
          expect(testUtil.refHash("refs/heads/other")).toEqual("3cc84b4c");
        });

        it("should stay on branch after merge", function() {
          g.merge("master");
          testUtil.expectFile(".gitlet/HEAD", "ref: refs/heads/other");
        });

        it("should return string describing merge strategy", function() {
          expect(g.merge("master")).toEqual("Merge made by the three-way strategy");
        });

        it("should allow merging of hash", function() {
          g.merge("505952f0");
          expect(testUtil.headHash()).toEqual("7b1641d0");
        });

        it("should say hash was merged in commit message", function() {
          g.merge("505952f0");

          var commitStrLines = testUtil.readFile(".gitlet/objects/" + testUtil.headHash())
              .split("\n");
          expect(commitStrLines[commitStrLines.length - 2])
            .toEqual("    Merge 505952f0 into other");
        });

        it("should say branch was merged in commit message", function() {
          g.merge("master");

          var commitStrLines = testUtil.readFile(".gitlet/objects/" + testUtil.headHash())
              .split("\n");
          expect(commitStrLines[commitStrLines.length - 2])
            .toEqual("    Merge master into other");
        });

        it("should remove MERGE_MSG after committing merge", function() {
          g.merge("master");
          expect(fs.existsSync(".gitlet/MERGE_MSG")).toEqual(false);
        });

        it("should remove MERGE_HEAD after committing merge", function() {
          g.merge("master");
          expect(fs.existsSync(".gitlet/MERGE_HEAD")).toEqual(false);
        });
      });

      describe("rm", function() {
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

          expect(Object.keys(testUtil.index()).length).toEqual(1);
          expect(testUtil.index()[0].path).toEqual("fileb");
        });
      });

      describe("add", function() {
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
          g.add(p.normalize("c1/filec"));
          g.commit({ m: "c" });

          g.merge("master");

          expect(testUtil.index().length).toEqual(3);
          expect(testUtil.index()[0].path).toEqual("filea");
          expect(testUtil.index()[1].path).toEqual(p.normalize("c1/filec"));
          expect(testUtil.index()[2].path).toEqual("fileb");

          testUtil.expectFile("filea", "filea");
          testUtil.expectFile("fileb", "fileb");
          testUtil.expectFile("c1/filec", "filec");

          var index = testUtil.index();
          expect(Object.keys(index).length).toEqual(3);
          expect(index[0].path).toEqual("filea");
          expect(index[1].path).toEqual(p.normalize("c1/filec"));
          expect(index[2].path).toEqual("fileb");
        });
      });

      describe("non-conflicting modify", function() {
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

          var index = testUtil.index();
          expect(Object.keys(index).length).toEqual(2);
          expect(index[0].path).toEqual("filea");
          expect(index[1].path).toEqual("fileb");
        });
      });

      describe("conflict", function() {
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

        describe("writing conflict", function() {
          it("should report there is a conflict when merging", function() {
            expect(g.merge("master"))
              .toEqual("Automatic merge failed. Fix conflicts and commit the result.");
          });

          it("should write index indicating conflicts", function() {
            g.merge("master");

            expect(testUtil.index().length).toEqual(3);

            expect(testUtil.index()[0].path).toEqual("filea");
            expect(testUtil.index()[0].stage).toEqual(1);
            testUtil.expectFile(".gitlet/objects/" + testUtil.index()[0].hash, "fileaa");

            expect(testUtil.index()[1].path).toEqual("filea");
            expect(testUtil.index()[1].stage).toEqual(2);
            testUtil.expectFile(".gitlet/objects/" + testUtil.index()[1].hash, "fileaaaa");

            expect(testUtil.index()[2].path).toEqual("filea");
            expect(testUtil.index()[2].stage).toEqual(3);
            testUtil.expectFile(".gitlet/objects/" + testUtil.index()[2].hash, "fileaaa");
          });

          it("should write conflict to working copy", function() {
            g.merge("master");

            testUtil.expectFile("filea", "<<<<<<\nfileaaaa\n======\nfileaaa\n>>>>>>\n");
          });

          it("should still have merge head when conflict happens", function() {
            g.merge("master");

            testUtil.expectFile(".gitlet/MERGE_HEAD", "1dd535ea");
          });
        });

        describe("committing with unresolved conflict", function() {
          it("should mention conflicted file", function() {
            g.merge("master");
            testUtil.expectFile(".gitlet/MERGE_HEAD", "1dd535ea"); // sanity: merging

            expect(function() { g.commit(); })
              .toThrow("U filea\ncannot commit because you have unmerged files\n");
          });

          it("should leave repo in merging stage", function() {
            g.merge("master");
            testUtil.expectFile(".gitlet/MERGE_HEAD", "1dd535ea"); // sanity: merging

            expect(function() { g.commit(); }).toThrow();
            testUtil.expectFile(".gitlet/MERGE_HEAD", "1dd535ea");
          });
        });

        describe("committing a resolved conflict", function() {
          it("should say that merge happened", function() {
            g.merge("master");
            testUtil.expectFile(".gitlet/MERGE_HEAD", "1dd535ea"); // sanity: merging

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            expect(g.commit()).toEqual("Merge made by the three-way strategy");
          });

          it("should not be merging after commit", function() {
            g.merge("master");

            expect(fs.existsSync(".gitlet/MERGE_HEAD")).toEqual(true);

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            g.commit();

            expect(fs.existsSync(".gitlet/MERGE_HEAD")).toEqual(false);
          });

          it("should remove MERGE_MSG after commit", function() {
            g.merge("master");

            expect(fs.existsSync(".gitlet/MERGE_HEAD")).toEqual(true);

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            g.commit();

            expect(fs.existsSync(".gitlet/MERGE_MSG")).toEqual(false);
          });

          it("should update index with merge", function() {
            g.merge("master");
            testUtil.expectFile(".gitlet/MERGE_HEAD", "1dd535ea"); // sanity: merging

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            g.commit();

            expect(testUtil.index().length).toEqual(1);
            expect(testUtil.index()[0].path).toEqual("filea");
          });

          it("should leave WC file as it was committed", function() {
            g.merge("master");
            testUtil.expectFile(".gitlet/MERGE_HEAD", "1dd535ea"); // sanity: merging

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            g.commit();

            testUtil.expectFile("filea", "fileaaa");
          });

          it("should commit merge commit with merged content", function() {
            g.merge("master");
            testUtil.expectFile(".gitlet/MERGE_HEAD", "1dd535ea"); // sanity: merging

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            g.commit();

            expect(Object.keys(testUtil.index()).length).toEqual(1);
            expect(testUtil.index()[0].path).toEqual("filea");
          });

          it("should leave head pointed at current branch", function() {
            g.merge("master");
            testUtil.expectFile(".gitlet/MERGE_HEAD", "1dd535ea"); // sanity: merging

            fs.writeFileSync("filea", "fileaaa");
            g.add("filea"); // resolve conflict
            g.commit();

            testUtil.expectFile(".gitlet/HEAD", "ref: refs/heads/other");
          });
        });
      });
    });
  });
});
