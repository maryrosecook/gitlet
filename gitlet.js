// Introduction
// ------------

// This code is intended to show how Git works under the covers.  It
// is written to be readable.  It is heavily commented.  However, my
// most digestible explanation of how Git works is in the (unfinished)
// essay, Git from the inside out.  It is best to read that before you
// read the code.  Or you can read the summary of the essay below.

// Git in six hundred words
// ------------------------

// Imagine you have a directory called `alpha`.  It contains a file
// called `number.txt` that contains just the string `"first"`.

// You run `git init` to set up the directory as a Git repository.
// This creates a `.git` folder inside the `alpha` directory.

// You run `git add number.txt` to add `number.txt` to the index.  The
// index maps filenames to hashes of the files' content.  The index
// now has the mapping `number.txt -> hash(first)`.  Running `add` has
// also created a new file in the Git object database at
// `alpha/.git/objects/`.  This file is called `hash(first)` and
// contains `"first"`.

// You run `git commit -m "first"`.  This creates a tree object in the
// objects database that represents the list of items in the top level
// of the alpha directory.  This object has an entry that points to
// the `hash(first)` object created when you ran `git add`.  It
// creates a commit object that represents the version of the repo
// that you just committed.  This includes a pointer to the tree that
// was created.  It sets the content of the file at
// `alpha/.git/refs/heads/master` to the hash of the commit object.

// You run `git clone . ../beta`.  This creates a new, separate
// directory called `beta`.  It initializes it as a Git repository.
// It copies the files in the objects directory of alpha to the
// objects directory of beta.  It sets the content of the file at
// `beta/.git/refs/heads/master` to the hash of the commit that the
// master branch on alpha is pointing at.  It sets the index on beta
// to mirror the content of the first commit.  It updates the working
// copy - the contents of the `beta` directory excluding the `.git`
// directory - so it mirrors the index.

// You move to the beta repository.  You change the content of
// `number.txt` to `second`.  You run `git add number.txt` and `git
// commit -m "second"`.  This time, the commit object that is created
// has a pointer to its parent, the first commit.

// You move back to the alpha repository.  You run `git pull beta
// master`.

// Under the covers, this runs `git fetch beta master`.  This finds
// the objects that comprise the second commit and copies them from
// the beta repository to the alpha repository.  It sets the content
// of the file at `alpha/.git/refs/remotes/beta/master` to the hash of
// the second commit.  It sets the contents of `alpha/.git/FETCH_HEAD`
// to indicate that master was fetched from the beta repository.

// Under the covers, the pull command runs `git merge FETCH_HEAD`.
// This reads `FETCH_HEAD`, which indicates that master on the beta
// repository was the most recently fetched branch.  It gets the hash
// in `alpha/.git/refs/remotes/beta/master` and uses it to get the
// second commit.  Since `master` on alpha is pointing at the first
// commit, and the first commit is an ancestor of the second commit,
// the contents of `alpha/.git/refs/heads/master` can just be set to
// the hash of the second commit.  Merge updates the index to mirror
// the contents of the second commit.  It updates the working copy to
// mirror the index.

// You run `git branch other`.  This creates a new file at
// `alpha/.git/refs/heads/other` that contains the hash for the second
// commit.

// You run `git checkout other`.  This changes the contents of the
// file at `alpha/.git/HEAD` from `"refs/heads/master"` to
// `"refs/heads/other"`.  `other` is now the current branch.

// You set the contents of `number.txt` to `"third"`, run `git add
// numbers.txt` and run `git commit -m "third"`.

// You run `git remote add beta ../beta`.  This sets the beta
// repository as a remote repository.  You run `git push beta other`.
// This finds the objects that comprise the third commit and copies
// them from the alpha repository to the beta repository.  It sets the
// content of the file at `beta/.git/refs/heads/other` to the hash of
// the third commit.

// Imports
// -------

var fs = require("fs");
var nodePath = require("path");

// Main Git API functions
// ----------------------

var gitlet = module.exports = {

  // **init()** initializes the current directory as a new repository.
  init: function(opts) {

    // Abort if already a repository.
    if (files.inRepo()) { return; }

    opts = opts || {};

    // Create a JS object that mirrors the Git basic directory
    // structure.
    var gitletStructure = {
      HEAD: "ref: refs/heads/master\n",

      // If `--bare` was passed, write to the Git config indicating
      // that the repository is bare.  If `--bare` was not passed,
      // write to the Git config saying the repository is not bare.
      config: config.objToStr({ core: { "": { bare: opts.bare === true }}}),

      objects: {},
      refs: {
        heads: {},
      }
    };

    // Write the standard Git directory structure using the
    // `gitletStructure` JS object.  If the repository is not bare,
    // put the directories inside the `.gitlet` directory.  If the
    // repository is bare, put them in the top level of the
    // repository.
    files.writeFilesFromTree(opts.bare ? gitletStructure : { ".gitlet": gitletStructure },
                             process.cwd());
  },

  // **add()** adds files that match `path` to the index.
  add: function(path, _) {
    files.assertInRepo();
    config.assertNotBare();

    // Get the paths of all the files matching `path`.
    var addedFiles = files.lsRecursive(path);

    // Abort if no files matched `path`.
    if (addedFiles.length === 0) {
      throw new Error(files.pathFromRepoRoot(path) + " did not match any files");

    // Otherwise, use the `update_index()` Git command to actually add
    // the files.
    } else {
      addedFiles.forEach(function(p) { gitlet.update_index(p, { add: true }); });
    }
  },

  // **rm()** removes files that match `path` from the index.
  rm: function(path, opts) {
    files.assertInRepo();
    config.assertNotBare();
    opts = opts || {};

    // Get the paths of all files in the index that match `path`.
    var filesToRm = index.matchingFiles(path);

    // Abort if `-f` was passed. The removal of files with changes is
    // not supported.
    if (opts.f) {
      throw new Error("unsupported");

    // Abort if no files matched `path`.
    } else if (filesToRm.length === 0) {
      throw new Error(files.pathFromRepoRoot(path) + " did not match any files");

    // Abort if `path` is a directory and `-r` was not passed.
    } else if (fs.existsSync(path) && fs.statSync(path).isDirectory() && !opts.r) {
      throw new Error("not removing " + path + " recursively without -r");

    } else {

      // Get a list of all files that are to be removed and have also
      // been changed on disk.  If this list is not empty then abort.
      var changesToRm = util.intersection(diff.addedOrModifiedFiles(), filesToRm);
      if (changesToRm.length > 0) {
        throw new Error("these files have changes:\n" + changesToRm.join("\n") + "\n");

      // Otherwise, remove the files that match `path`. Delete them
      // from disk and remove from the index.
      } else {
        filesToRm.map(files.workingCopyPath).filter(fs.existsSync).forEach(fs.unlinkSync);
        filesToRm.forEach(function(p) { gitlet.update_index(p, { remove: true }); });
      }
    }
  },

  // **commit()** creates a commit object that represents the current
  // state of the index, writes the commit to the `objects` directory
  // and points `HEAD` at the commit.
  commit: function(opts) {
    files.assertInRepo();
    config.assertNotBare();

    // Write a tree object that represents the current state of the
    // index.
    var treeHash = this.write_tree();

    var headDesc = refs.isHeadDetached() ? "detached HEAD" : refs.headBranchName();

    // If the hash of the new tree is the same as the hash of the tree
    // that the `HEAD` commit points at, abort because there is
    // nothing new to commit.
    if (refs.hash("HEAD") !== undefined &&
        treeHash === objects.treeHash(objects.read(refs.hash("HEAD")))) {
      throw new Error("# On " + headDesc + "\nnothing to commit, working directory clean");

    } else {

      // Abort if the repository is in the merge state and there are
      // unresolved merge conflicts.
      var conflictedPaths = index.conflictedPaths();
      if (merge.isMergeInProgress() && conflictedPaths.length > 0) {
        throw new Error(conflictedPaths.map(function(p) { return "U " + p; }).join("\n") +
                        "\ncannot commit because you have unmerged files\n");

      // Otherwise, do the commit.
      } else {

        // If the repository is in the merge state, use a pre-written
        // merge commit message.  If the repository is not in the
        // merge state, use the message passed with `-m`.
        var m = merge.isMergeInProgress() ? files.read(files.gitletPath("MERGE_MSG")) : opts.m

        // Write the new commit to the `objects` directory.
        var commitHash = objects.writeCommit(treeHash, m, refs.commitParentHashes());

        // Point `HEAD` at new commit.
        this.update_ref("HEAD", commitHash);

        // If `MERGE_HEAD` exists, the repository was in the merge
        // state. Remove `MERGE_HEAD` and `MERGE_MSG`to exit the merge
        // state.  Report that the merge is complete.
        if (merge.isMergeInProgress()) {
          fs.unlinkSync(files.gitletPath("MERGE_MSG"));
          refs.rm("MERGE_HEAD");
          return "Merge made by the three-way strategy";

        // Repository was not in the merge state, so just report that
        // the commit is complete.
        } else {
          return "[" + headDesc + " " + commitHash + "] " + m;
        }
      }
    }
  },

  // **branch()** creates a new branch that points at the commit that
  // `HEAD` points at.
  branch: function(name, opts) {
    files.assertInRepo();
    opts = opts || {};

    // If no branch `name` was passed, list the local branches.
    if (name === undefined) {
      return Object.keys(refs.localHeads()).map(function(branch) {
        return (branch === refs.headBranchName() ? "* " : "  ") + branch;
      }).join("\n") + "\n";

    // `HEAD` is not pointing at a commit, so there is no commit for
    // the new branch to point at.  Abort.  This is most likely to
    // happen if the repository has no commits.
    } else if (refs.hash("HEAD") === undefined) {
      throw new Error(refs.headBranchName() + " not a valid object name");

    // Abort because a branch called `name` already exists.
    } else if (refs.exists(refs.toLocalRef(name))) {
      throw new Error("A branch named " + name + " already exists");

    // Otherwise, create a new branch by creating a new file called
    // `name` that contains the hash of the commit that `HEAD` points
    // at.
    } else {
      this.update_ref(refs.toLocalRef(name), refs.hash("HEAD"));
    }
  },

  // **checkout()** changes the index, working copy and `HEAD` to
  // reflect the content of `ref`.  `ref` might be a branch name or a
  // commit hash.
  checkout: function(ref, _) {
    files.assertInRepo();
    config.assertNotBare();

    // Get the hash of the commit to check out.
    var toHash = refs.hash(ref);

    // Abort if `ref` cannot be found.
    if (!objects.exists(toHash)) {
      throw new Error(ref + " did not match any file(s) known to Gitlet");

    // Abort if the hash to check out points to an object that is a
    // not a commit.
    } else if (objects.type(objects.read(toHash)) !== "commit") {
      throw new Error("reference is not a tree: " + ref);

    // Abort if `ref` is the name of the branch currently checked out.
    // Abort if head is detached, `ref` is a commit hash and `HEAD` is
    // pointing at that hash.
    } else if (ref === refs.headBranchName() ||
               ref === files.read(files.gitletPath("HEAD"))) {
      return "Already on " + ref;
    } else {

      // Get a list of files changed in the working copy.  Get a list
      // of the files that are different in the head commit and the
      // commit to check out.  If any files appear in both lists then
      // abort.
      var paths = diff.changedFilesCommitWouldOverwrite(toHash);
      if (paths.length > 0) {
        throw new Error("local changes would be lost\n" + paths.join("\n") + "\n")

      // Otherwise, perform the checkout.
      } else {
        process.chdir(files.workingCopyPath());

        // If the ref is in the `objects` directory, it must be a hash
        // and so this checkout is detaching the head.
        var isDetachingHead = objects.exists(ref);

        // Get the list of differences between the current commit and
        // the commit to check out.  Write them to the working copy.
        workingCopy.write(diff.diff(refs.hash("HEAD"), toHash));

        // Write the commit being checked out to `HEAD`. If the head
        // is being detached, the commit hash is written directly to
        // the `HEAD` file.  If the head is not being detached, the
        // branch being checked out is written to `HEAD`.
        refs.write("HEAD", isDetachingHead ? toHash : "ref: " + refs.toLocalRef(ref));

        // Set the index to the contents of the commit being checked
        // out.
        index.write(index.tocToIndex(objects.commitToc(toHash)));

        // Report the result of the checkout.
        return isDetachingHead ?
          "Note: checking out " + toHash + "\nYou are in detached HEAD state." :
          "Switched to branch " + ref;
      }
    }
  },

  // **diff()** shows the changes required to go from the `ref1`
  // commit to the `ref2` commit.
  diff: function(ref1, ref2, opts) {
    files.assertInRepo();
    config.assertNotBare();

    // Abort if `ref1` was supplied, but it does not resolve to a
    // hash.
    if (ref1 !== undefined && refs.hash(ref1) === undefined) {
      throw new Error("ambiguous argument " + ref1 + ": unknown revision");

    // Abort if `ref2` was supplied, but it does not resolve to a
    // hash.
    } else if (ref2 !== undefined && refs.hash(ref2) === undefined) {
      throw new Error("ambiguous argument " + ref2 + ": unknown revision");

    // Otherwise, perform diff.
    } else {

      // Gitlet only shows the name of each changed file and whether
      // it was added, modified or deleted.  For simplicity, the
      // changed content is not shown.

      // The diff happens between two versions of the repository.  The
      // first version is either the hash that `ref1` resolves to, or
      // the index.  The second version is either the hash that `ref2`
      // resolves to, or the working copy.
      var nameToStatus = diff.nameStatus(diff.diff(refs.hash(ref1), refs.hash(ref2)));

      // Show the path of each changed file.
      return Object.keys(nameToStatus)
        .map(function(path) { return nameToStatus[path] + " " + path; })
        .join("\n") + "\n";
    }
  },

  // **remote()** records the locations of remote versions of this
  // repository.
  remote: function(command, name, path, _) {
    files.assertInRepo();

    // Abort if `command` is not "add".  Only "add" is supported.
    if (command !== "add") {
      throw new Error("unsupported");

    // Abort if repository already has a record for a remote called
    // `name`.
    } else if (name in config.read()["remote"]) {
      throw new Error("remote " + name + " already exists");

    // Otherwise, add remote record.
    } else {

      // Write to the config file a record of the `name` and `path` of
      // the remote.
      config.write(util.setIn(config.read(), ["remote", name, "url", path]));
      return "\n";
    }
  },

  // **fetch()** records the commit that `branch` is at on `remote`.
  // It does not change the local branch.
  fetch: function(remote, branch, _) {
    files.assertInRepo();

    // Abort if a `remote` or `branch` not passed.
    if (remote === undefined || branch === undefined) {
      throw new Error("unsupported");

    // Abort if `remote` not recorded in config file.
    } else if (!(remote in config.read().remote)) {
      throw new Error(remote + " does not appear to be a git repository");

    } else {

      // Get the location of the remote.
      var remoteUrl = config.read().remote[remote].url;

      // Turn the unqualified branch name into a qualified remote ref
      // eg `[branch] -> refs/remotes/[remote]/[branch]`
      var remoteRef =  refs.toRemoteRef(remote, branch);

      // Go to the remote repository and get the hash of the commit
      // that `branch` is on.
      var newHash = util.remote(remoteUrl)(refs.hash, branch);

      // Abort if `branch` did not exist on the remote.
      if (newHash === undefined) {
        throw new Error("couldn't find remote ref " + branch);

      // Otherwise, perform the fetch.
      } else {

        // Note down the hash of the commit this repository currently
        // thinks the remote branch is on.
        var oldHash = refs.hash(remoteRef);

        // Get all the objects in the remote `objects` directory and
        // write them.  to the local `objects` directory.  (This is an
        // inefficient way of getting all the objects required to
        // recreate locally the commit the remote branch is on.)
        var remoteObjects = util.remote(remoteUrl)(objects.allObjects);
        remoteObjects.forEach(objects.write);

        // Set the contents of the file at
        // `.gitlet/refs/remotes/[remote]/[branch]` to `newHash`, the
        // hash of the commit that the remote branch is on.
        gitlet.update_ref(remoteRef, newHash);

        // Record the hash of the commit that the remote branch is on
        // in `FETCH_HEAD`.  (The user can call `gitlet merge
        // FETCH_HEAD` to merge the remote version of the branch into
        // their local branch.  For more details, see
        // [gitlet.merge()](#section-76).)
        refs.write("FETCH_HEAD", newHash + " branch " + branch + " of " + remoteUrl);

        // Report the result of the fetch.
        return ["From " + remoteUrl,
                "Count " + remoteObjects.length,
                branch + " -> " + remote + "/" + branch +
                (merge.isAForceFetch(oldHash, newHash) ? " (forced)" : "")].join("\n") + "\n";
      }
    }
  },

  // **merge()** finds the set of differences between the commit that
  // the currently checked out branch is on and the commit that `ref`
  // points to.  It finds or creates a commit that applies these
  // differences to the checked out branch.
  merge: function(ref, _) {
    files.assertInRepo();
    config.assertNotBare();

    // Get the `receiverHash`, the hash of the commit that thet
    // current branch is on.
    var receiverHash = refs.hash("HEAD");

    // Get the `giverHash`, the hash for the commit to merge into the
    // receiver commit.
    var giverHash = refs.hash(ref);

    // Abort if head is detached.  Merging into a detached head is not
    // supported.
    if (refs.isHeadDetached()) {
      throw new Error("unsupported");

    // Abort if `ref` did not resolve to a hash, or if that hash is
    // not for a commit object.
    } else if (giverHash === undefined || objects.type(objects.read(giverHash)) !== "commit") {
      throw new Error(ref + ": expected commit type");

    // Do not merge if the current branch - the receiver - already has
    // the giver's changes.  This is the case if the receiver and
    // giver are the same commit, or if the giver is an ancestor of
    // the receiver.
    } else if (objects.isUpToDate(receiverHash, giverHash)) {
      return "Already up-to-date";

    } else {

      // Get a list of files changed in the working copy.  Get a list
      // of the files that are different in the receiver and giver. If
      // any files appear in both lists then abort.
      var paths = diff.changedFilesCommitWouldOverwrite(giverHash);
      if (paths.length > 0) {
        throw new Error("local changes would be lost\n" + paths.join("\n") + "\n");

      // If the receiver is an ancestor of the giver, a fast forward
      // is performed.  This is possible because there is already a
      // commit that incorporates all of the giver's changes into the
      // receiver.
      } else if (merge.canFastForward(receiverHash, giverHash)) {

        // Fast forwarding means making the current branch reflect the
        // commit that `giverHash` points at.  The branch is pointed
        // at `giverHash`.  The index is set to match the contents of
        // the commit that `giverHash` points at.  The working copy is
        // set to match the contents of that commit.
        merge.writeFastForwardMerge(receiverHash, giverHash);
        return "Fast-forward";

      // If the receiver is not an ancestor of the giver, a merge
      // commit must be created.
      } else {

        // The repository is put into the merge state.  The
        // `MERGE_HEAD` file is written and its contents set to
        // `giverHash`.  The `MERGE_MSG` file is written and its
        // contents set to a boilerplate merge commit message.  A
        // merge diff is created that will turn the contents of
        // receiver into the contents of giver.  This contains the
        // path of every file that is different and whether it was
        // added, removed or modified, or is in conflict.  Added files
        // are added to the index and working copy.  Removed files are
        // removed from the index and working copy.  Modified files
        // are modified in the index and working copy.  Files that are
        // in conflict are written to the working copy to include the
        // receiver and giver versions.  Both the receiver and giver
        // versions are written to the index.
        merge.writeNonFastForwardMerge(receiverHash, giverHash, ref);

        // If there are any conflicted files, a message is shown to
        // say that the user must sort them out before the merge can
        // be completed.
        if (merge.hasConflicts(receiverHash, giverHash)) {
          return "Automatic merge failed. Fix conflicts and commit the result.";

        // If there are no conflicted files, a commit is created from
        // the merged changes and the merge is over.
        } else {
          return this.commit();
        }
      }
    }
  },

  // **pull()** fetches the commit that `branch` is on at `remote`.
  // It merges that commit into the current branch.
  pull: function(remote, branch, _) {
    files.assertInRepo();
    config.assertNotBare();
    this.fetch(remote, branch);
    return this.merge("FETCH_HEAD");
  },

  // **push()** gets the commit that `branch` is on in the local repo
  // and points `branch` on `remote` at the same commit.
  push: function(remote, branch, opts) {
    files.assertInRepo();
    opts = opts || {};

    // Abort if a `remote` or `branch` not passed.
    if (remote === undefined || branch === undefined) {
      throw new Error("unsupported");

    // Abort if `remote` not recorded in config file.
    } else if (!(remote in config.read().remote)) {
      throw new Error(remote + " does not appear to be a git repository");

    } else {
      var remotePath = config.read().remote[remote].url;
      var remoteCall = util.remote(remotePath);

      // Abort if remote repository is not bare and `branch` is
      // checked out.
      if (remoteCall(refs.isCheckedOut, branch)) {
        throw new Error("refusing to update checked out branch " + branch);

      } else {

        // Get `receiverHash`, the hash of the commit that `branch` is
        // on at `remote`.
        var receiverHash = remoteCall(refs.hash, branch);

        // Get `giverHash`, the hash of the commit that `branch` is on
        // at the local repository.
        var giverHash = refs.hash(branch);

        // Do nothing if the remote branch - the receiver - has
        // already incorporated the commit that `giverHash` points
        // to. This is the case if the receiver commit and giver
        // commit are the same, or if the giver commit is an ancestor
        // of the receiver commit.
        if (objects.isUpToDate(receiverHash, giverHash)) {
          return "Already up-to-date";

        // Abort if `branch` on `remote` cannot be fast forwarded to
        // the commit that `giverHash` points to.  A fast forward can
        // only be done if the receiver commit is an ancestor of the
        // giver commit.
        } else if (!opts.f && !merge.canFastForward(receiverHash, giverHash)) {
          throw new Error("failed to push some refs to " + remotePath);

        // Otherwise, do the push.
        } else {

          // Put all the objects in the local `objects` directory into
          // the remote `objects` directory.
          objects.allObjects().forEach(function(o) { remoteCall(objects.write, o); });

          // Point `branch` on `remote` at `giverHash`.
          remoteCall(gitlet.update_ref, refs.toLocalRef(branch), giverHash);

          // Set the local repo's record of what commit `branch` is on
          // at `remote` to `giverHash` (since that is what it is now
          // is).
          gitlet.update_ref(refs.toRemoteRef(remote, branch), giverHash);

          // Report the result of the push.
          return ["To " + remotePath,
                  "Count " + objects.allObjects().length,
                  branch + " -> " + branch].join("\n") + "\n";
        }
      }
    }
  },

  // **status()** reports the state of the repo: the current branch,
  // untracked files, conflicted files, files that are staged to be
  // committed and files that are not staged to be committed.
  status: function(_) {
    files.assertInRepo();
    config.assertNotBare();
    return status.toString();
  },

  // **clone()** copies the repository at `remotePath` to
  // **`targetPath`.
  clone: function(remotePath, targetPath, opts) {
    opts = opts || {};

    // Abort if a `remotePath` or `targetPath` not passed.
    if (remotePath === undefined || targetPath === undefined) {
      throw new Error("you must specify remote path and target path");

    // Abort if `remotePath` does not exist, or is not a Gitlet
    // repository.
    } else if (!fs.existsSync(remotePath) || !util.remote(remotePath)(files.inRepo)) {
      throw new Error("repository " + remotePath + " does not exist");

    // Abort if `targetPath` exists and is not empty.
    } else if (fs.existsSync(targetPath) && fs.readdirSync(targetPath).length > 0) {
      throw new Error(targetPath + " already exists and is not empty");

    // Otherwise, do the clone.
    } else {

      remotePath = nodePath.resolve(process.cwd(), remotePath);

      // If `targetPath` doesn't exist, create it.
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath)
      }

      // In the directory for the new remote repository...
      util.remote(targetPath)(function() {

        // Initialize the directory as a Gitlet repository.
        gitlet.init(opts);

        // Set up `remotePath` as a remote called "origin".
        gitlet.remote("add", "origin", nodePath.relative(process.cwd(), remotePath));

        // Get the hash of the commit that master is pointing at on
        // the remote repository.
        var remoteHeadHash = util.remote(remotePath)(refs.hash, "master");

        // If the remote repo has any commits, that hash will exist.
        // The new repository records the commit that the passed
        // `branch` is at on the remote.  It then sets master on the
        // new repository to point at that commit.
        if (remoteHeadHash !== undefined) {
          gitlet.fetch("origin", "master");
          merge.writeFastForwardMerge(undefined, remoteHeadHash);
        }
      });

      // Report the result of the clone.
      return "Cloning into " + targetPath;
    }
  },

  // **update_index()** adds the contents of the file at `path` to the
  // index, or removes the file from the index.
  update_index: function(path, opts) {
    files.assertInRepo();
    config.assertNotBare();
    opts = opts || {};

    var pathFromRoot = files.pathFromRepoRoot(path);
    var isOnDisk = fs.existsSync(path);
    var isInIndex = index.hasFile(path, 0);

    // Abort if `path` is a directory.  `update_index()` only handles
    // single files.
    if (isOnDisk && fs.statSync(path).isDirectory()) {
      throw new Error(pathFromRoot + " is a directory - add files inside\n");

    } else if (opts.remove && !isOnDisk && isInIndex) {

      // Abort if file is being removed and is in conflict.  Gitlet
      // doesn't support this.
      if (index.isFileInConflict(path)) {
        throw new Error("unsupported");

      // If files is being removed, is not on disk and is in the
      // index, remove it from the index.
      } else {
        index.writeRm(path);
        return "\n";
      }

    // If file is being removed, is not on disk and not in the index,
    // there is no work to do.
    } else if (opts.remove && !isOnDisk && !isInIndex) {
      return "\n";

    // Abort if the file is on disk and not in the index and the
    // `--add` was not passed.
    } else if (!opts.add && isOnDisk && !isInIndex) {
      throw new Error("cannot add " + pathFromRoot + " to index - use --add option\n");

    // If file is on disk and either `-add` was passed or the file is
    // in the index, add the file's current content to the index.
    } else if (isOnDisk && (opts.add || isInIndex)) {
      index.writeAdd(path);
      return "\n";

    // Abort if the file is not on disk and `--remove` not passed.
    } else if (!opts.remove && !isOnDisk) {
      throw new Error(pathFromRoot + " does not exist and --remove not passed\n");
    }
  },

  // **write_tree()** takes the content of the index and stores a tree
  // object that represents that content to the `objects` directory.
  write_tree: function(_) {
    files.assertInRepo();
    return objects.writeTree(files.nestFlatTree(index.toc()));
  },

  // **update_ref()** gets the hash of the commit that `refToUpdateTo`
  // points at and sets `refToUpdate` to point at the same hash.
  update_ref: function(refToUpdate, refToUpdateTo, _) {
    files.assertInRepo();

    // Get the hash that `refToUpdateTo` points at.
    var hash = refs.hash(refToUpdateTo);

    // Abort if `refToUpdateTo` does not point at a hash.
    if (!objects.exists(hash)) {
      throw new Error(refToUpdateTo + " not a valid SHA1");

    // Abort if `refToUpdate` does not match the syntax of a ref.
    } else if (!refs.isRef(refToUpdate)) {
      throw new Error("cannot lock the ref " + refToUpdate);

    // Abort if `hash` points to an object in the `objects` directory
    // that is not a commit.
    } else if (objects.type(objects.read(hash)) !== "commit") {
      var branch = refs.terminalRef(refToUpdate);
      throw new Error(branch + " cannot refer to non-commit object " + hash + "\n");

    // Otherwise, set the contents of the file that the ref represents
    // to `hash`.
    } else {
      refs.write(refs.terminalRef(refToUpdate), hash);
    }
  }
};

// Refs module
// -----------

// Refs are names for commit hashes.  The ref is the name of a file.
// Some refs represent local branches, like `refs/heads/master` or
// `refs/heads/feature`.  Some represent remote branches, like
// `refs/remotes/origin/master`.  Some represent important states of
// the repository, like `HEAD`, `MERGE_HEAD` and `FETCH_HEAD`.  Ref
// files contain either a hash or another ref.

var refs = {

  // **isRef()** returns true if `ref` matches valid qualified ref
  // syntax.
  isRef: function(ref) {
    return ref !== undefined &&
      (ref.match("refs/heads/[A-Za-z-]+") ||
       ref.match("refs/remotes/[A-Za-z-]+/[A-Za-z-]+") ||
       ["HEAD", "FETCH_HEAD", "MERGE_HEAD"].indexOf(ref) !== -1);
  },

  // **terminalRef()** resolves `ref` to the most specific ref
  // possible.
  terminalRef: function(ref) {

    // If `ref` is "HEAD" and head is pointing at a branch, return the
    // branch.
    if (ref === "HEAD" && !this.isHeadDetached()) {
      return files.read(files.gitletPath("HEAD")).match("ref: (refs/heads/.+)")[1];

    // If ref is qualified, return it.
    } else if (refs.isRef(ref)) {
      return ref;

    // Otherwise, assume ref is an unqualified local ref (like
    // `master`) and turn it into a qualified ref (like
    // `refs/heads/master`)
    } else {
      return refs.toLocalRef(ref);
    }
  },

  // **hash()** returns the hash that `refOrHash` points to.
  hash: function(refOrHash) {
    if (objects.exists(refOrHash)) {
      return refOrHash;
    } else {
      var terminalRef = refs.terminalRef(refOrHash);
      if (terminalRef === "FETCH_HEAD") {
        return refs.fetchHeadBranchToMerge(refs.headBranchName());
      } else if (refs.exists(terminalRef)) {
        return files.read(files.gitletPath(terminalRef));
      }
    }
  },

  // **isHeadDetached()** returns true if `HEAD` contains a commit
  // hash, rather than the ref of a branch.
  isHeadDetached: function() {
    return files.read(files.gitletPath("HEAD")).match("refs") === null;
  },

  // **isCheckedOut()** returns true if the repository is not bare and
  // `HEAD` is pointing at the branch called `branch`
  isCheckedOut: function(branch) {
    return !config.isBare() && refs.headBranchName() === branch;
  },

  // **toLocalRef()** converts the branch name `name` into a qualified
  // local branch ref.
  toLocalRef: function(name) {
    return "refs/heads/" + name;
  },

  // **toLocalRef()** converts `remote` and branch name `name` into a
  // qualified remote branch ref.
  toRemoteRef: function(remote, name) {
    return "refs/remotes/" + remote + "/" + name;
  },

  // **write()** sets the content of the file for the qualified ref
  // `ref` to `content`.
  write: function(ref, content) {
    if(refs.isRef(ref)) {
      var tree = util.setIn({}, ref.split(nodePath.sep).concat(content));
      files.writeFilesFromTree(tree, files.gitletPath());
    }
  },

  // **rm()** removes the file for the qualified ref `ref`.
  rm: function(ref) {
    if(refs.isRef(ref)) {
      fs.unlinkSync(files.gitletPath(ref));
    }
  },

  // **fetchHeadBranchToMerge()** reads the `FETCH_HEAD` file and gets
  // the hash that the remote `branchName` is pointing at.  For more
  // information about `FETCH_HEAD` see [gitlet.fetch()](#section-63).
  fetchHeadBranchToMerge: function(branchName) {
    return util.lines(files.read(files.gitletPath("FETCH_HEAD")))
      .filter(function(l) { return l.match("^.+ branch " + branchName + " of"); })
      .map(function(l) { return l.match("^([^ ]+) ")[1]; })[0];
  },

  // **localHeads()** returns a JS object that maps local branch names
  // to the hash of the commit they point to.
  localHeads: function() {
    return fs.readdirSync(nodePath.join(files.gitletPath(), "refs", "heads"))
      .reduce(function(o, n) { return util.setIn(o, [n, refs.hash(n)]); }, {});
  },

  // **exists()** returns true if the qualified ref `ref` exists.
  exists: function(ref) {
    return refs.isRef(ref) && fs.existsSync(files.gitletPath(ref));
  },

  // **headBranchName()** returns the name of the branch that `HEAD`
  // is pointing at.
  headBranchName: function() {
    if (!refs.isHeadDetached()) {
      return files.read(files.gitletPath("HEAD")).match("refs/heads/(.+)")[1];
    }
  },

  // **commitParentHashes()** returns the array of commits that would
  // be the parents of the next commit.
  commitParentHashes: function() {
    var headHash = refs.hash("HEAD");

    // If the repository is in the middle of a merge, return the
    // hashes of the two commits being merged.
    if (merge.isMergeInProgress()) {
      return [headHash, refs.hash("MERGE_HEAD")];

    // If this repository has no commits, return an empty array.
    } else if (headHash === undefined) {
      return [];

    // Otherwise, return the hash of the commit that `HEAD` is
    // currently pointing at.
    } else {
      return [headHash];
    }
  }
};

// Objects module
// -----------

// Objects are files in the `.gitlet/objects/` directory.
// - A blob object stores the content of a file.  For example, if a
//   file called `numbers.txt` that contains `first` is added to the
//   index, a blob called `hash(first)` will be created containinc
//   `"first"`.
// - A tree object stores a list of files and directories in a
//   directory in the repository.  Entries in the list for files point
//   to blob objects.  Entries in the list for directories point at
//   other tree objects.
// - A commit object stores a pointer to a tree object and a message.
//   It represents the state of the repository after a commit.

var objects = {

  // **writeTree()** stores a graph of tree objects that represent the
  // content currently in the index.
  writeTree: function(tree) {
    var treeObject = Object.keys(tree).map(function(key) {
      if (util.isString(tree[key])) {
        return "blob " + tree[key] + " " + key;
      } else {
        return "tree " + objects.writeTree(tree[key]) + " " + key;
      }
    }).join("\n") + "\n";

    return objects.write(treeObject);
  },

  // **fileTree()** takes a tree hash and finds the corresponding tree
  // object.  It reads the connected graph of tree objects into a
  // nested JS object, like:<br/>
  // `{ file1: "hash(1)", src: { file2:  "hash(2)" }`
  fileTree: function(treeHash, tree) {
    if (tree === undefined) { return objects.fileTree(treeHash, {}); }

    util.lines(objects.read(treeHash)).forEach(function(line) {
      var lineTokens = line.split(/ /);
      tree[lineTokens[2]] = lineTokens[0] === "tree" ?
        objects.fileTree(lineTokens[1], {}) :
        lineTokens[1];
    });

    return tree;
  },

  // **writeCommit()** creates a commit object and writes it to the
  // objects database.
  writeCommit: function(treeHash, message, parentHashes) {
    return this.write("commit " + treeHash + "\n" +
                      parentHashes.map(function(h) { return "parent " + h + "\n"; }).join("")+
                      "Date:  " + new Date().toString() + "\n" +
                      "\n" +
                      "    " + message + "\n");
  },

  // **write()** writes `str` to the objects database.
  write: function(str) {
    files.write(nodePath.join(files.gitletPath(), "objects", util.hash(str)), str);
    return util.hash(str);
  },

  // **isUpToDate()** returns true if the giver commit has already
  // been incorporated into the receiver commit.  That is, it returns
  // true if the giver commit is an ancestor of the receiver, or they
  // are the same commit.
  isUpToDate: function(receiverHash, giverHash) {
    return receiverHash !== undefined &&
      (receiverHash === giverHash || objects.isAncestor(receiverHash, giverHash));
  },

  // **exists()** returns true if there is an object in the database
  // called `objectHash`
  exists: function(objectHash) {
    return objectHash !== undefined &&
      fs.existsSync(nodePath.join(files.gitletPath(), "objects", objectHash));
  },

  // **read()** returns the content of the object called `objectHash`.
  read: function(objectHash) {
    if (objectHash !== undefined) {
      var objectPath = nodePath.join(files.gitletPath(), "objects", objectHash);
      if (fs.existsSync(objectPath)) {
        return files.read(objectPath);
      }
    }
  },

  // **allObjects()** returns an array of the string content of all
  // the objects in the database
  allObjects: function() {
    return fs.readdirSync(files.gitletPath("objects")).map(objects.read);
  },

  // **type()** parses `str` as an object and returns its type:
  // commit, tree or blob.
  type: function(str) {
    return { commit: "commit", tree: "tree", blob: "tree" }[str.split(" ")[0]] || "blob";
  },

  // **isAncestor()** returns true if `descendentHash` is a descendent
  // of `ancestorHash`.
  isAncestor: function(descendentHash, ancestorHash) {
    return objects.ancestors(descendentHash).indexOf(ancestorHash) !== -1;
  },

  // **ancestors()** returns an array of the hashes of all the
  // ancestor commits of `commitHash`.
  ancestors: function(commitHash) {
    var parents = objects.parentHashes(objects.read(commitHash));
    return util.flatten(parents.concat(parents.map(objects.ancestors)));
  },

  // **parentHashes()** parses `str` as a commit and returns the
  // hashes of its parents.
  parentHashes: function(str) {
    if (objects.type(str) === "commit") {
      return str.split("\n")
        .filter(function(line) { return line.match(/^parent/); })
        .map(function(line) { return line.split(" ")[1]; });
    }
  },

  // **parentHashes()** parses `str` as a commit and returns the tree
  // it points at.
  treeHash: function(str) {
    if (objects.type(str) === "commit") {
      return str.split(/\s/)[1];
    }
  },

  // **commitToc()** takes the hash of a commit and reads the content
  // stored in the tree on the commit.  It turns that tree into a
  // table of content that maps filenames to hashes of the files'
  // content, like: `{ "file1": hash(1), "a/file2": "hash(2)" }`
  commitToc: function(hash) {
    return files.flattenNestedTree(objects.fileTree(objects.treeHash(objects.read(hash))));
  }
};

// Index module
// ------------

// The index maps files to hashes of their content.  When a commit is
// created, a tree is built that mirrors the content of the index.

// Index entry keys are actually a `path,stage` combination.  Stage is
// always `0`, unless the entry is about a file that is in conflict.
// See `merge.writeIndex()` for more details.

var index = {

  // **hasFile()** returns true if there is an entry for `path` in the
  // index `stage`.
  hasFile: function(path, stage) {
    return index.read()[index.key(path, stage)] !== undefined;
  },

  // **read()** returns the index as a JS object.
  read: function() {
    var indexFilePath = files.gitletPath("index");
    return util.lines(fs.existsSync(indexFilePath) ? files.read(indexFilePath) : "\n")
      .reduce(function(idx, blobStr) {
        var blobData = blobStr.split(/ /);
        idx[index.key(blobData[0], blobData[1])] = blobData[2];
        return idx;
      }, {});
  },

  // **key()** returns an index key made from `path` and `stage`.
  key: function(path, stage) {
    return path + "," + stage;
  },

  // **keyPieces()** returns a JS object that contains the path and
  // stage of 'key`.
  keyPieces: function(key) {
    var pieces = key.split(/,/);
    return { path: pieces[0], stage: parseInt(pieces[1]) };
  },

  // **toc()** returns an object that maps file paths to hashes of
  // their content.  This function is like `read()`, except the JS
  // object it returns only uses the file path as a key.
  toc: function() {
    var idx = index.read();
    return Object.keys(idx)
      .reduce(function(obj, k) { return util.setIn(obj, [k.split(",")[0], idx[k]]); }, {});
  },

  // **isFileInConflict()** returns true the file for `path` is in
  // conflict.
  isFileInConflict: function(path) {
    return index.hasFile(path, 2);
  },

  // **conflictedPaths()** returns an array of all the paths of files
  // that are in conflict.
  conflictedPaths: function() {
    var idx = index.read();
    return Object.keys(idx)
      .filter(function(k) { return index.keyPieces(k).stage === 2; })
      .map(function(k) { return index.keyPieces(k).path; });
  },

  // **writeAdd()** gets the current content of the file at `path` in
  // the working copy.  It stores that content in the index.  If that
  // file is in conflict, it is set to be no longer in conflict.
  writeAdd: function(path) {
    if (index.isFileInConflict(path)) {
      index.rmEntry(path, 1);
      index.rmEntry(path, 2);
      index.rmEntry(path, 3);
    }

    index.writeEntry(path, 0, files.read(files.workingCopyPath(path)));
  },

  // **writeRm()** removes `path` from the index.  This operation will
  // do nothing if the file is in conflict.
  writeRm: function(path) {
    index.rmEntry(path, 0);
  },

  // **writeEntry()** adds a hash of `content` to the index at key
  // `path,stage`.
  writeEntry: function(path, stage, content) {
    var idx = index.read();
    idx[index.key(path, stage)] = objects.write(content);
    index.write(idx);
  },

  // **rmEntry()** removes the entry at key `path,stage`.
  rmEntry: function(path, stage) {
    var idx = index.read();
    delete idx[index.key(path, stage)];
    index.write(idx);
  },

  // **write()** takes a JS object that represents an index and writes
  // it to `.gitlet/index`.
  write: function(index) {
    var indexStr = Object.keys(index)
        .map(function(k) { return k.split(",")[0] + " " + k.split(",")[1] + " " + index[k] })
        .join("\n") + "\n";
    files.write(files.gitletPath("index"), indexStr);
  },

  // **workingCopyToc()** returns an object that maps the file paths
  // in the working copy to hashes of those files' content.
  workingCopyToc: function() {
    return Object.keys(index.read())
      .map(function(k) { return k.split(",")[0]; })
      .filter(function(p) { return fs.existsSync(files.workingCopyPath(p)); })
      .reduce(function(idx, p) {
        idx[p] = util.hash(files.read(files.workingCopyPath(p)))
        return idx;
      }, {});
  },

  // **tocToIndex()** takes an object that maps file paths to hashes
  // of the files' content.  It returns an object that is identical,
  // except the keys of the object are composed of the file paths and
  // stage `0`.  eg: `{ "file1,0": hash(1), "src/file2,0": hash(2) }'
  tocToIndex: function(toc) {
    return Object.keys(toc)
      .reduce(function(idx, p) { return util.setIn(idx, [index.key(p, 0), toc[p]]); }, {});
  },

  // **matchingFiles()** returns all the paths in the index that match
  // `pathSpec`.  It matches relative to `currentDir`.
  matchingFiles: function(pathSpec) {
    var searchPath = files.pathFromRepoRoot(pathSpec);
    return Object.keys(index.toc())
      .filter(function(p) { return p.match("^" + searchPath); });
  }
};

// Diff module
// -----------

// Produces diffs between versions of the repository content.  Diffs
// are represented as JS objects that map file paths to objects that
// indicate the change required to get from the first version of the
// file (the receiver) to the second (the giver).  eg:
// <pre>{
//   file1: {
//     status: "A",
//     receiver: undefined,
//     base: undefined,
//     giver: hash(1)
//   },
//   file2: {
//     status: "C",
//     receiver: hash(b),
//     base: hash(a),
//     giver: hash(c)
//   }
// }</pre>

var diff = {
  FILE_STATUS: { ADD: "A", MODIFY: "M", DELETE: "D", SAME: "SAME", CONFLICT: "CONFLICT" },

  // **diff()** returns a diff object (see above for the format of a
  // diff object).  If `hash1` is passed, it is used as the first
  // version in the diff.  If it is not passed, the index is used.  If
  // `hash2` is passed, it is used as the second version in the diff.
  // If it is not passed` the working copy is used.
  diff: function(hash1, hash2) {
    var a = hash1 === undefined ? index.toc() : objects.commitToc(hash1);
    var b = hash2 === undefined ? index.workingCopyToc() : objects.commitToc(hash2);
    return diff.tocDiff(a, b);
  },

  // **nameStatus()** takes a diff and returns a JS object that maps
  // from file paths to file statuses.
  nameStatus: function(dif) {
    return Object.keys(dif)
      .filter(function(p) { return dif[p].status !== diff.FILE_STATUS.SAME; })
      .reduce(function(ns, p) { return util.setIn(ns, [p, dif[p].status]); }, {});
  },

  // **tocDiff()** takes three JS objects that map file paths to
  // hashes of file content.  It returns a diff between `receiver` and
  // `giver` (see the module description for the format).  `base` is
  // the version that is the most recent commen ancestor of the
  // `receiver` and `giver`.  If `base` is not passed, `receiver` is
  // used as the base.  The base is only passed when getting the diff
  // for a merge.  This is the only time the conflict status might be
  // used.
  tocDiff: function(receiver, giver, base) {

    // fileStatus() takes three strings that represent different
    // versions of the content of a file.  It returns the change that
    // needs to be made to get from the `receiver` to the `giver`.
    function fileStatus(receiver, giver, base) {
      var receiverPresent = receiver !== undefined;
      var basePresent = base !== undefined;
      var giverPresent = giver !== undefined;
      if (receiverPresent && giverPresent && receiver !== giver) {
        if (receiver !== base && giver !== base) {
          return diff.FILE_STATUS.CONFLICT;
        } else {
          return diff.FILE_STATUS.MODIFY;
        }
      } else if (receiver === giver) {
        return diff.FILE_STATUS.SAME;
      } else if ((!receiverPresent && !basePresent && giverPresent) ||
                 (receiverPresent && !basePresent && !giverPresent)) {
        return diff.FILE_STATUS.ADD;
      } else if ((receiverPresent && basePresent && !giverPresent) ||
                 (!receiverPresent && basePresent && giverPresent)) {
        return diff.FILE_STATUS.DELETE;
      }
    };

    // If `base` was not passed, use `receiver` as the base.
    base = base || receiver;

    // Get an array of all the paths in all the versions.
    var paths = Object.keys(receiver).concat(Object.keys(base)).concat(Object.keys(giver));

    // Create and return diff.
    return util.unique(paths).reduce(function(idx, p) {
      return util.setIn(idx, [p, {
        status: fileStatus(receiver[p], giver[p], base[p]),
        receiver: receiver[p],
        base: base[p],
        giver: giver[p]
      }]);
    }, {});
  },

  // **changedFilesCommitWouldOverwrite()** gets a list of files
  // changed in the working copy.  It gets a list of the files that
  // are different in the head commit and the commit for the passed
  // hash.  It returns a list of paths that appear in both lists.
  changedFilesCommitWouldOverwrite: function(hash) {
    var headHash = refs.hash("HEAD");
    var hashToWcDiff = diff.nameStatus(diff.diff(headHash));
    var headToHashDiff = diff.nameStatus(diff.diff(headHash, hash));
    return Object.keys(hashToWcDiff).filter(function(p) { return p in headToHashDiff; });
  },

  // **addedOrModifiedFiles()** returns a list of files that have been
  // added to or modified in the working copy since the last commit.
  addedOrModifiedFiles: function() {
    var headToc = refs.hash("HEAD") ? objects.commitToc(refs.hash("HEAD")) : {};
    var wc = diff.nameStatus(diff.tocDiff(headToc, index.workingCopyToc()));
    return Object.keys(wc).filter(function(p) { return wc[p] !== diff.FILE_STATUS.DELETE; });
  }
};


// Merge module
// ------------

var merge = {

  // **commonAncestor()** returns the hash of the commit that is the
  // most recent common ancestor of `aHash` and `bHash`.
  commonAncestor: function(aHash, bHash) {
    var sorted = [aHash, bHash].sort();
    aHash = sorted[0];
    bHash = sorted[1];
    var aAncestors = [aHash].concat(objects.ancestors(aHash));
    var bAncestors = [bHash].concat(objects.ancestors(bHash));
    return util.intersection(aAncestors, bAncestors)[0];
  },

  // **isMergeInProgress()** returns true if the repository is in the
  // middle of a merge.
  isMergeInProgress: function() {
    return refs.hash("MERGE_HEAD");
  },

  // **canFastForward()** A fast forward is possible if the changes
  // made to get to the `giverHash` commit already incorporate the
  // changes made to get to the `receiverHash` commit.  So,
  // `canFastForward()` returns true if the `receiverHash` commit is
  // an ancestor of the `giverHash` commit.  It also returns true if
  // there is no `receiverHash` commit because this indicates the
  // repository has no commits, yet.
  canFastForward: function(receiverHash, giverHash) {
    return receiverHash === undefined || objects.isAncestor(giverHash, receiverHash);
  },

  // **isAForceFetch()** returns true if hash for local commit
  // (`receiverHash`) is not ancestor of hash for fetched commit
  // (`giverHash`).
  isAForceFetch: function(receiverHash, giverHash) {
    return receiverHash !== undefined && !objects.isAncestor(giverHash, receiverHash);
  },

  // **hasConflicts()** returns true if merging the commit for
  // `giverHash` into the commit for `receiverHash` would produce
  // conflicts.
  hasConflicts: function(receiverHash, giverHash) {
    var mergeDiff = merge.mergeDiff(receiverHash, giverHash);
    return Object.keys(mergeDiff)
      .filter(function(p){return mergeDiff[p].status===diff.FILE_STATUS.CONFLICT }).length > 0
  },

  // **mergeDiff()** returns a diff that represents the changes to get
  // from the `receiverHash` commit to the `giverHash` commit.
  // Because this is a merge diff, the function uses the common
  // ancestor of the `receiverHash` commit and `giverHash` commit to
  // avoid trivial conflicts.
  mergeDiff: function(receiverHash, giverHash) {
    return diff.tocDiff(objects.commitToc(receiverHash),
                        objects.commitToc(giverHash),
                        objects.commitToc(merge.commonAncestor(receiverHash, giverHash)));
  },

  // **writeMergeMsg()** creates a message for the merge commit that
  // will potentially be created when the `giverHash` commit is merged
  // into the `receiverHash` commit.  It writes this message to
  // `.gitlet/MERGE_MSG`.
  writeMergeMsg: function(receiverHash, giverHash, ref) {
    var msg = "Merge " + ref + " into " + refs.headBranchName();

    var mergeDiff = merge.mergeDiff(receiverHash, giverHash);
    var conflicts = Object.keys(mergeDiff)
        .filter(function(p) { return mergeDiff[p].status === diff.FILE_STATUS.CONFLICT });
    if (conflicts.length > 0) {
      msg += "\nConflicts:\n" + conflicts.join("\n");
    }

    files.write(files.gitletPath("MERGE_MSG"), msg);
  },

  // **writeIndex()** merges the `giverHash` commit into the
  // `receiverHash` commit and writes the merged content to the index.
  writeIndex: function(receiverHash, giverHash) {
    var mergeDiff = merge.mergeDiff(receiverHash, giverHash);
    index.write({});
    Object.keys(mergeDiff).forEach(function(p) {
      if (mergeDiff[p].status === diff.FILE_STATUS.CONFLICT) {
        if (mergeDiff[p].base !== undefined) { // (undef if same filepath ADDED w dif content)
          index.writeEntry(p, 1, objects.read(mergeDiff[p].base));
        }

        index.writeEntry(p, 2, objects.read(mergeDiff[p].receiver));
        index.writeEntry(p, 3, objects.read(mergeDiff[p].giver));
      } else if (mergeDiff[p].status === diff.FILE_STATUS.MODIFY) {
        index.writeEntry(p, 0, mergeDiff[p].giver);
      } else if (mergeDiff[p].status === diff.FILE_STATUS.ADD ||
                 mergeDiff[p].status === diff.FILE_STATUS.SAME) {
        var content = objects.read(mergeDiff[p].receiver || mergeDiff[p].giver);
        index.writeEntry(p, 0, content);
      }
    });
  },

  // **writeFastForwardMerge()** Fast forwarding means making the
  // current branch reflect the commit that `giverHash` points at.  No
  // new commit is created.
  writeFastForwardMerge: function(receiverHash, giverHash) {

    // Point head at `giverHash`.
    refs.write(refs.toLocalRef(refs.headBranchName()), giverHash);

    // Make the index mirror the content of `giverHash`.
    index.write(index.tocToIndex(objects.commitToc(giverHash)));

    // If the repo is bare, it has no working copy, so there is no
    // more work to do.  If the repo is not bare...
    if (!config.isBare()) {

      // ...Get an object that maps from file paths in the
      // `receiverHash` commit to hashes of the files' content.  If
      // `recevierHash` is undefined, the repository has no commits,
      // yet, and the mapping object is empty.
      var receiverToc = receiverHash === undefined ? {} : objects.commitToc(receiverHash);

      // ...and write the content of the files to the working copy.
      workingCopy.write(diff.tocDiff(receiverToc, objects.commitToc(giverHash)));
    }
  },

  // **writeNonFastForwardMerge()** A non fast forward merge creates a
  // merge commit to integrate the content of the `receiverHash`
  // commit with the content of the `giverHash` commit.  This
  // integration requires a merge commit because, unlike a fast
  // forward merge, no commit yet exists that embodies the combination
  // of these two commits.  `writeNonFastForwardMerge()` does not
  // actually create the merge commit.  It just sets the wheels in
  // motion.
  writeNonFastForwardMerge: function(receiverHash, giverHash, giverRef) {

    // Write `giverHash` to `.gitlet/MERGE_HEAD`.  This file acts as a
    // record of `giverHash` and as the signal that the repository is
    // in the merging state.
    refs.write("MERGE_HEAD", giverHash);

    // Write a standard merge commit message that will be used when
    // the merge commit is created.
    merge.writeMergeMsg(receiverHash, giverHash, giverRef);

    // Merge the `receiverHash` commit with the `giverHash` commit and
    // write the content to the index.
    merge.writeIndex(receiverHash, giverHash);

    // If the repo is bare, it has no working copy, so there is no
    // more work to do.  If the repo is not bare...
    if (!config.isBare()) {

      // ...merge the `receiverHash` commit with the `giverHash`
      // commit and write the content to the working copy.
      workingCopy.write(merge.mergeDiff(receiverHash, giverHash));
    }
  }
};

// Working copy module
// -------------------

// The working copy is the set of files that are inside the
// repository, excluding the `.gitlet` directory.

var workingCopy = {

  // **write()** takes a diff object (see the diff module for a
  // description of the format) and applies the changes in it to the
  // working copy.
  write: function(dif) {

    // `composeConflict()` takes the hashes of two versions of the
    // same file and returns a string that represents the two versions
    // as a conflicted file:
    // <pre><<<<<
    // version1
    // `======
    // version2
    // `>>>>></pre>
    // Note that Gitlet, unlike real Git, does not do a line by line
    // diff and mark only the conflicted parts of the file.  If a file
    // is in conflict, the whole body of the file is marked as one big
    // conflict.
    function composeConflict(receiverFileHash, giverFileHash) {
      return "<<<<<<\n" + objects.read(receiverFileHash) +
        "\n======\n" + objects.read(giverFileHash) +
        "\n>>>>>>\n";
    };

    // Go through all the files that have changed, updating the
    // working copy for each.
    Object.keys(dif).forEach(function(p) {
      if (dif[p].status === diff.FILE_STATUS.ADD) {
        files.write(files.workingCopyPath(p), objects.read(dif[p].receiver || dif[p].giver));
      } else if (dif[p].status === diff.FILE_STATUS.CONFLICT) {
        files.write(files.workingCopyPath(p), composeConflict(dif[p].receiver, dif[p].giver));
      } else if (dif[p].status === diff.FILE_STATUS.MODIFY) {
        files.write(files.workingCopyPath(p), objects.read(dif[p].giver));
      } else if (dif[p].status === diff.FILE_STATUS.DELETE) {
        fs.unlinkSync(files.workingCopyPath(p));
      }
    });

    // Remove any directories that have been left empty after the
    // deletion of all the files in them.
    fs.readdirSync(files.workingCopyPath())
      .filter(function(n) { return n !== ".gitlet"; })
      .forEach(files.rmEmptyDirs);
  }
};

// Config module
// -------------

// This code allows the config file at `.gitlet/config` to be read and
// written.

var config = {

  // **isBare()** returns true if the repository is bare.
  isBare: function() {
    return config.read().core[""].bare === "true";
  },

  // **assertNotBare()** throws if the repository is bare.
  assertNotBare: function() {
    if (config.isBare()) {
      throw new Error("this operation must be run in a work tree");
    }
  },

  // **read()** returns the contents of the config file as a nested JS
  // object.
  read: function() {
    return config.strToObj(files.read(files.gitletPath("config")));
  },

  // **write()** stringifies the nested JS object `configObj` and
  // overwrites the config file with it.
  write: function(configObj) {
    files.write(files.gitletPath("config"), config.objToStr(configObj));
  },

  // **strToObj()** parses the config string `str` and returns its
  // contents as a nested JS object.
  strToObj: function(str) {
    return str.split("[")
      .map(function(item) { return item.trim(); })
      .filter(function(item) { return item !== ""; })
      .reduce(function(c, item) {
        var lines = item.split("\n");
        var entry = [];

        // section eg "core"
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

        return util.setIn(c, entry);
      }, { "remote": {} });
  },

  // **objToStr()** `configObj` is a JS object that holds the config
  // for the repository.  `objToStr()` stringifies the object and
  // returns the string.
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

// Util module
// -----------

// A set of handy functions.

var util = {

  // **isString()** returns true if `thing` is a string.
  isString: function(thing) {
    return typeof thing === "string";
  },

  // **hash()** returns a hash of `string`.
  hash: function(string) {
    var hashInt = 0;
    for (var i = 0; i < string.length; i++) {
      hashInt = hashInt * 31 + string.charCodeAt(i);
      hashInt = hashInt | 0;
    }

    return Math.abs(hashInt).toString(16);
  },

  // **setIn()** takes an array that contains 1 or more keys and has
  // one value at the end.  It drills down into `obj` using the keys
  // and sets the value as the value of the last key.  eg<br/>
  // `setIn({}, ["a", "b", "me"]); // => { a: { b: "me" } }`
  setIn: function(obj, arr) {
    if (arr.length === 2) {
      obj[arr[0]] = arr[1];
    } else if (arr.length > 2) {
      obj[arr[0]] = obj[arr[0]] || {};
      util.setIn(obj[arr[0]], arr.slice(1));
    }

    return obj;
  },

  // **lines()** takes a string, splits on newlines and returns an
  // array of the lines that are not empty.
  lines: function(str) {
    return str.split("\n").filter(function(l) { return l !== ""; });
  },

  // **flatten()** returns a flattened version of `arr`.
  flatten: function(arr) {
    return arr.reduce(function(a, e) {
      return a.concat(e instanceof Array ? util.flatten(e) : e);
    }, []);
  },

  // **unique()** returns the unique elements in `arr`.
  unique: function(arr) {
    return arr.reduce(function(a, p) { return a.indexOf(p) === -1 ? a.concat(p) : a; }, []);
  },

  // **intersection()** takes two arrays `a` and `b`.  It returns an
  // array of the items that appear in both.
  intersection: function(a, b) {
    return a.filter(function(e) { return b.indexOf(e) !== -1; });
  },

  // **remote()** allows execution of a command on a remote
  // repository.  It returns an anonymous function that takes another
  // function `fn`.  When the anonymous function is run, it switches
  // to `remotePath`, executes `fn`, then switches back to the
  // original directory.
  remote: function(remotePath) {
    return function(fn) {
      var originalDir = process.cwd();
      process.chdir(remotePath);
      var result = fn.apply(null, Array.prototype.slice.call(arguments, 1));
      process.chdir(originalDir);
      return result;
    };
  }
};

// Files module
// ------------

var files = {

  // **inRepo()** returns true if the current working directory is
  // inside a repository.
  inRepo: function() {
    return files.gitletPath() !== undefined;
  },

  // **assertInRepo()** throws if the current working directory is not
  // inside a repository.
  assertInRepo: function() {
    if (!files.inRepo()) {
      throw new Error("not a Gitlet repository");
    }
  },

  // **pathFromRepoRoot()** returns `path` relative to the repo root
  pathFromRepoRoot: function(path) {
    return nodePath.relative(files.workingCopyPath(), nodePath.join(process.cwd(), path));
  },

  // **write()** writes `content` to file at `path`, overwriting
  // anything that is already there.
  write: function(path, content) {
    files.writeFilesFromTree(util.setIn({}, path.split(nodePath.sep).concat(content)), "/");
  },

  // **writeFilesFromTree()** takes `tree` of files as a nested JS obj
  // and writes all those files to disk taking `prefix` as the root of
  // the tree.  `tree` format is: `{ a: { b: { c: "filecontent" }}}`
  writeFilesFromTree: function(tree, prefix) {
    Object.keys(tree).forEach(function(name) {
      var path = nodePath.join(prefix, name);
      if (util.isString(tree[name])) {
        fs.writeFileSync(path, tree[name]);
      } else {
        if (!fs.existsSync(path)) {
          fs.mkdirSync(path, "777");
        }

        files.writeFilesFromTree(tree[name], path);
      }
    });
  },

  // **rmEmptyDirs()** recursively remotes all the empty directories
  // inside `path`.
  rmEmptyDirs: function(path) {
    if (fs.statSync(path).isDirectory()) {
      fs.readdirSync(path).forEach(function(c) { files.rmEmptyDirs(nodePath.join(path, c)); });
      if (fs.readdirSync(path).length === 0) {
        fs.rmdirSync(path);
      }
    }
  },

  // **read()** returns the contents of the file at `path` as a
  // string.  It returns `undefined` if the file doesn't exist.
  read: function(path) {
    if (fs.existsSync(path)) {
      return fs.readFileSync(path, "utf8");
    }
  },

  // **gitletPath()** returns a string made by concatenating `path` to
  // the absolute path of the `.gitlet` directory of the repository.
  gitletPath: function(path) {
    function gitletDir(dir) {
      if (fs.existsSync(dir)) {
        var potentialConfigFile = nodePath.join(dir, "config");
        var potentialGitletPath = nodePath.join(dir, ".gitlet");
        if (fs.existsSync(potentialConfigFile) &&
            files.read(potentialConfigFile).match(/\[core\]/)) {
          return dir;
        } else if (fs.existsSync(potentialGitletPath)) {
          return potentialGitletPath;
        } else if (dir !== "/") {
          return gitletDir(nodePath.join(dir, ".."));
        }
      }
    };

    var gDir = gitletDir(process.cwd());
    if (gDir !== undefined) {
      return nodePath.join(gDir, path || "");
    }
  },

  // **gitletPath()** returns a string made by concatenating `path` to
  // the absolute path of the root of the repository.
  workingCopyPath: function(path) {
    return nodePath.join(nodePath.join(files.gitletPath(), ".."), path || "");
  },

  // **lsRecursive()** returns an array of all the files found in a
  // recursive search of `path`.
  lsRecursive: function(path) {
    if (!fs.existsSync(path)) {
      return [];
    } else if (fs.statSync(path).isFile()) {
      return [path];
    } else if (fs.statSync(path).isDirectory()) {
      var self = this;
      return fs.readdirSync(path).reduce(function(fileList, dirChild) {
        return fileList.concat(files.lsRecursive(nodePath.join(path, dirChild)));
      }, []);
    }
  },

  // **nestFlatTree()** takes `obj`, a mapping of file path strings to
  // content, and returns a nested JS obj where each key represents a
  // sub directory.  This is the opposite of
  // `flattenNestedTree()`<br/>
  // eg `nestFlatTree({ "a/b": "me" }); // => { a: { b: "me" }}`
  nestFlatTree: function(obj) {
    return Object.keys(obj).reduce(function(tree, wholePath) {
      return util.setIn(tree, wholePath.split(nodePath.sep).concat(obj[wholePath]));
    }, {});
  },

  // **flattenNestedTree()** takes `tree`, a nested JS object where
  // each key represents a sub directory and returns a JS object
  // mapping file path strings to content.  This is the opposite of
  // `nestFlatTree()`<br/>
  // eg `flattenNestedTree({ a: { b: "me" }}); // => { "a/b": "me"}`
  flattenNestedTree: function(tree, obj, prefix) {
    if (obj === undefined) { return files.flattenNestedTree(tree, {}, ""); }

    Object.keys(tree).forEach(function(dir) {
      var path = nodePath.join(prefix, dir);
      if (util.isString(tree[dir])) {
        obj[path] = tree[dir];
      } else {
        files.flattenNestedTree(tree[dir], obj, path);
      }
    });

    return obj;
  }
};

// Status module
// -------------

// Outputs the repository status as a human-readable string.

var status = {

  // **toString()** returns the repository status as a human-readable
  // string.
  toString: function() {

    // **currentBranch()** returns an array of lines stating what
    // branch the repository is on.
    function currentBranch() {
      return ["On branch " + refs.headBranchName()];
    };

    // **untracked()** returns an array of lines listing the files not
    // being tracked by Gitlet.
    function untracked() {
      var paths = fs.readdirSync(files.workingCopyPath())
          .filter(function(p) { return index.toc()[p] === undefined && p !== ".gitlet"; });
      return paths.length > 0 ? ["Untracked files:"].concat(paths) : [];
    };

    // **conflicted()** returns an array of lines listing the files
    // that are in conflict.
    function conflicted() {
      var paths = index.conflictedPaths();
      return paths.length > 0 ? ["Unmerged paths:"].concat(paths) : [];
    };

    // **toBeCommitted()** returns an array of lines listing the files
    // that have changes that will be included in the next commit.
    function toBeCommitted() {
      var headHash = refs.hash("HEAD");
      var headToc = headHash === undefined ? {} : objects.commitToc(headHash);
      var ns = diff.nameStatus(diff.tocDiff(headToc, index.toc()));
      var entries = Object.keys(ns).map(function(p) { return ns[p] + " " + p; });
      return entries.length > 0 ? ["Changes to be committed:"].concat(entries) : [];
    };

    // **notStagedForCommit()** returns an array of lines listing the
    // files that have changes that will not be included in the next
    // commit.
    function notStagedForCommit() {
      var ns = diff.nameStatus(diff.diff());
      var entries = Object.keys(ns).map(function(p) { return ns[p] + " " + p; });
      return entries.length > 0 ? ["Changes not staged for commit:"].concat(entries) : [];
    };

    // Gather all the arrays of lines for each section.  Throw away
    // the sections with no content. Return the rest as string.
    return [currentBranch(),
            untracked(),
            conflicted(),
            toBeCommitted(),
            notStagedForCommit()]
      .reduce(function(a, section) {
        return section.length > 0 ? a.concat(section, "") : a;
      }, [])
      .join("\n");
  }
};

// Running gitlet.js as a script
// -----------------------------

// Gitlet can be used from the command line.  For example, executing
// `node gitlet.js commit -m woo` would commit to the current repo
// with the message "woo".

// **parseOptions()** takes the `process.argv` object passed when
// gitlet.js is run as a script. It returns an object that contains
// the parsed parameters to be formed into a Gitlet command.
var parseOptions = function(argv) {
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

// **runCli()** takes the `process.argv` object passed when gitlet.js
// is run as a script.  It parses the command line arguments, runs the
// corresponding Gitlet command and returns the string returned by the
// command.
var runCli = module.exports.runCli = function (argv) {
  var rawArgs = parseOptions(argv);
  var commandFnName = rawArgs._[2].replace(/-/g, "_");
  var fn = gitlet[commandFnName];
  var commandArgs = rawArgs._.slice(3);
  var unspecifiedArgs = Array
      .apply(null, new Array(fn.length - commandArgs.length - 1))
      .map(function() { return undefined; });

  return fn.apply(gitlet, commandArgs.concat(unspecifiedArgs).concat(rawArgs));
};

// If `gitlet.js` is run as a script, pass the `process.argv` array of
// script arguments to `runCli()` so they can be used to run a Gitlet
// command.  Print the return value of the Gitlet command.  If the
// Gitlet command throws, print the error message.
if (require.main === module) {
  try {
    console.log(runCli(process.argv));
  } catch (e) {
    console.log(e)
  }
}
