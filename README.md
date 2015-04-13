# Gitlet

Git implemented in JavaScript.

Over the last six years, I've become better at using Git for version control.  But my conceptions of the index, the working copy, the object graph and remotes have just grown fuzzier.

Sometimes, I can only understand something by implementing it. So, I wrote Gitlet, my own version of Git. I pored over tutorials. I read articles about internals. I tried to understand how API commands work by reading the docs, then gave up and ran hundreds of experiments on repositories and rummaged throught the `.git` directory to figure out the results.

I discovered that, if approached from the inside out, Git is easy to understand. It is the product of simple ideas that, when combined, produce something very deep and beautiful.

## Using Gitlet to understand Git

If you would like to understand what happens when you run the basic Git commands, you can read [Git in six hundred words](http://maryrosecook.com/blog/post/git-in-six-hundred-words).

Afterwards, read the [heavily annotated Gitlet source](http://gitlet.maryrosecook.com/docs/gitlet.html). 1000 lines of code sounds intimidating. But it's OK. The annotations explain both Git and the code in great detail. The code mirrors the terminology of the Git command line interface, so it should be approachable. And the implementation of the main Git commands is just 350 lines.

I wrote an article, [Introducing Gitlet](http://maryrosecook.com/blog/post/introducing-gitlet), about the process of writing the code.

## Getting the code

Clone it from [GitHub](https://github.com/maryrosecook/gitlet)

```bash
$ git clone git@github.com:maryrosecook/gitlet.git
```

Or install it from [npm](https://www.npmjs.com/package/gitlet).

```bash
$ npm install -g gitlet
```

## Using Gitlet for version control

I wrote Gitlet to explain how Git works. It would be unwise to use Gitlet to version control your projects. But it does work.  Sort of.

First, install [Node.js](http://nodejs.org/#download).  Then:

```bash
    $ npm install -g gitlet

    $ mkdir a
    $ cd a
./a $ gitlet init

./a $ echo first > number.txt
./a $ gitlet add number.txt
./a $ gitlet commit -m "first"
      [master 2912d7a2] first

./a $ cd ..
    $ gitlet clone a b

    $ cd b
./b $ echo second > number.txt
./b $ gitlet add number.txt
./b $ gitlet commit -m "second"
      [master 484de172] second

    $ cd ../a
./a $ gitlet remote add b ../b
./a $ gitlet fetch b master
      From ../b
      Count 6
      master -> b/master
./a $ gitlet merge FETCH_HEAD
      Fast-forward

./a $ gitlet branch other
./a $ gitlet checkout other
      Switched to branch other

./a $ echo third > number.txt
./a $ gitlet add number.txt
./a $ gitlet commit -m "third"
      [other 656b332d] third

./a $ gitlet push b other
      To ../b
      Count 9
      other -> other
```

## Running the tests

Install [Node.js](http://nodejs.org/#download).

```bash
$ git clone git@github.com:maryrosecook/gitlet.git
$ cd gitlet
$ npm install
$ npm test
```

## Contact

Mary Rose Cook - http://maryrosecook.com<br/>
I made this while working at the [Recurse Center](https://www.recurse.com).
