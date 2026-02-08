import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { createVFSLinterHost } from "../host/createVFSLinterHost.ts";
import type { VFSLinterHost } from "../types/host.ts";
import { createGitignoreFilter } from "./createGitignoreFilter.ts";

describe("createGitignoreFilter", () => {
	const integrationRoot = "/root";

	let host: VFSLinterHost;

	beforeEach(() => {
		host = createVFSLinterHost({
			caseSensitive: true,
			cwd: integrationRoot,
		});
	});

	// root/
	// └── src/
	//     └── file.ts
	it("returns true for files when no .gitignore exists", () => {
		const filePath = path.join(integrationRoot, "src", "file.ts");
		host.vfsUpsertFile(filePath, "content");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(filePath)).toBe(true);
	});

	// root/
	// ├── .gitignore   (# comment, *.log, # comment)
	// ├── debug.log    ❌ ignored
	// └── index.ts     ✓ not ignored
	it("ignores comments and empty lines", () => {
		host.vfsUpsertFile(
			path.join(integrationRoot, ".gitignore"),
			"# This is a comment\n\n*.log\n   \n# Another comment",
		);
		const logFile = path.join(integrationRoot, "debug.log");
		const tsFile = path.join(integrationRoot, "index.ts");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(logFile)).toBe(false);
		expect(gitignoreFilter(tsFile)).toBe(true);
	});

	// root/
	// ├── .gitignore   (#comment.txt, \#real.txt)
	// ├── comment.txt      ✓ not ignored (# is comment)
	// └── #real.txt        ❌ ignored (escaped #)
	it("handles escaped hash at the beginning", () => {
		host.vfsUpsertFile(
			path.join(integrationRoot, ".gitignore"),
			"#comment.txt\n\\#real.txt",
		);
		const comment = path.join(integrationRoot, "comment.txt");
		const hashFile = path.join(integrationRoot, "#real.txt");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(comment)).toBe(true);
		expect(gitignoreFilter(hashFile)).toBe(false);
	});

	// root/
	// ├── .gitignore   (*.log    - 4 non-escaped trailing spaces)
	// ├── test.log         ❌ ignored (trailing spaces are automatically removed)
	// └── test.txt         ✓ not ignored
	it("handles non-escaped trailing spaces (automatically removed)", () => {
		host.vfsUpsertFile(
			path.join(integrationRoot, ".gitignore"),
			"*.log    ", // 4 trailing spaces (non-escaped)
		);
		const logFile = path.join(integrationRoot, "test.log");
		const txtFile = path.join(integrationRoot, "test.txt");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(logFile)).toBe(false);
		expect(gitignoreFilter(txtFile)).toBe(true);
	});

	// root/
	// ├── .gitignore   (file\ with\ space<space>, file\ with\ escapedSpace\ )
	// │                 ↑ non-escaped trailing space (will be removed)
	// │                 ↑ escaped trailing space (will be kept)
	// ├── file with space<space>          ❌ ignored (matches first pattern after trailing space removed)
	// ├── file with space                 ✓ not ignored (extra space, doesn't match)
	// ├── file with escapedSpace<space>   ❌ ignored (matches second pattern with escaped trailing space)
	// ├── file with space.js              ✓ not ignored
	// └── normal.txt                      ✓ not ignored
	it("handles escaped trailing spaces", () => {
		host.vfsUpsertFile(
			path.join(integrationRoot, ".gitignore"),
			// First pattern: "file\ with\ space " (non-escaped trailing space, will be removed)
			// Second pattern: "file\ with\ escapedSpace\ " (escaped trailing space, will be kept)
			"file\\ with\\ space \nfile\\ with\\ escapedSpace\\ ",
		);

		const fileNoTrailingSpace = path.join(integrationRoot, "file with space");
		const fileWithExtraSpace = path.join(integrationRoot, "file with space ");

		const fileWithEscapedSpace = path.join(
			integrationRoot,
			"file with escapedSpace ",
		);

		const fileWithDifferentName = path.join(
			integrationRoot,
			"file with space.js",
		);
		const normalFile = path.join(integrationRoot, "normal.txt");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);

		expect(gitignoreFilter(fileNoTrailingSpace)).toBe(false);
		expect(gitignoreFilter(fileWithExtraSpace)).toBe(true);
		expect(gitignoreFilter(fileWithEscapedSpace)).toBe(false);
		expect(gitignoreFilter(fileWithDifferentName)).toBe(true);
		expect(gitignoreFilter(normalFile)).toBe(true);
	});

	// root/
	// ├── .gitignore   (  *.log with leading spaces)
	// ├── test.log         ✓ not ignored (leading spaces prevent matching)
	// ├──   test.log       ❌ ignored (matched by pattern with leading spaces)
	// └── test.txt         ✓ not ignored
	it("treats leading spaces as part of the pattern", () => {
		host.vfsUpsertFile(path.join(integrationRoot, ".gitignore"), "  *.log");
		const logFile = path.join(integrationRoot, "test.log");
		const logFileWithSpaces = path.join(integrationRoot, "  test.log");
		const txtFile = path.join(integrationRoot, "test.txt");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(logFile)).toBe(true);
		expect(gitignoreFilter(logFileWithSpaces)).toBe(false);
		expect(gitignoreFilter(txtFile)).toBe(true);
	});

	// root/
	// ├── .gitignore       (*.log, !important.log)
	// ├── debug.log        ❌ ignored
	// ├── !important.log   ❌ ignored
	// └── important.log    ✓ not ignored (negated)
	it("handles negation patterns", () => {
		host.vfsUpsertFile(
			path.join(integrationRoot, ".gitignore"),
			"*.log\n!important.log",
		);
		const debugLog = path.join(integrationRoot, "debug.log");
		const importantLog = path.join(integrationRoot, "important.log");
		const importantLogNegated = path.join(integrationRoot, "!important.log");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(debugLog)).toBe(false);
		expect(gitignoreFilter(importantLogNegated)).toBe(false);
		expect(gitignoreFilter(importantLog)).toBe(true);
	});

	// root/
	// ├── .gitignore   (\!literal.txt)
	// └── !literal.txt     ❌ ignored (escaped !)
	it("handles escaped exclamation mark at the beginning", () => {
		host.vfsUpsertFile(
			path.join(integrationRoot, ".gitignore"),
			"\\!literal.txt",
		);
		const literal = path.join(integrationRoot, "!literal.txt");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(literal)).toBe(false);
	});

	// root/
	// ├── .gitignore   (parent/, !parent/child.txt)
	// ├── parent/
	// │   ├── child.txt    ❌ ignored (parent dir excluded)
	// │   └── nested/
	// │       └── file.txt ❌ ignored (parent dir excluded)
	// └── other.txt        ✓ not ignored
	it("cannot re-include files when parent directory is excluded", () => {
		host.vfsUpsertFile(
			path.join(integrationRoot, ".gitignore"),
			"parent/\n!parent/child.txt",
		);
		const childFile = path.join(integrationRoot, "parent", "child.txt");
		const nestedFile = path.join(
			integrationRoot,
			"parent",
			"nested",
			"file.txt",
		);
		const otherFile = path.join(integrationRoot, "other.txt");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(childFile)).toBe(false);
		expect(gitignoreFilter(nestedFile)).toBe(false);
		expect(gitignoreFilter(otherFile)).toBe(true);
	});

	// root/
	// ├── .gitignore         (/build)
	// ├── build/
	// │   └── output.js      ❌ ignored (root /build)
	// └── src/
	//     ├── build/
	//     │   └── output.js  ✓ not ignored
	//     └── index.ts       ✓ not ignored
	it("handles absolute path patterns with leading slash", () => {
		host.vfsUpsertFile(path.join(integrationRoot, ".gitignore"), "/build");
		const rootBuild = path.join(integrationRoot, "build", "output.js");
		const srcFile = path.join(integrationRoot, "src", "index.ts");
		const srcBuild = path.join(integrationRoot, "src", "build", "output.js");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(rootBuild)).toBe(false);
		expect(gitignoreFilter(srcFile)).toBe(true);
		expect(gitignoreFilter(srcBuild)).toBe(true);
	});

	// root/
	// └── src/
	//     ├── .gitignore   (foo/bar.js - pattern with slash in middle)
	//     ├── foo/
	//     │   └── bar.js       ❌ ignored (relative to src/)
	//     ├── nested/
	//     │   └── foo/
	//     │       └── bar.js   ✓ not ignored (slash makes it relative, not recursive)
	//     └── baz.js           ✓ not ignored
	it("handles patterns with slash in the middle", () => {
		const srcDir = path.join(integrationRoot, "src");
		host.vfsUpsertFile(path.join(srcDir, ".gitignore"), "foo/bar.js");

		const directMatch = path.join(srcDir, "foo", "bar.js");
		const nestedMatch = path.join(srcDir, "nested", "foo", "bar.js");
		const otherFile = path.join(srcDir, "baz.js");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(directMatch)).toBe(false);
		expect(gitignoreFilter(nestedMatch)).toBe(true);
		expect(gitignoreFilter(otherFile)).toBe(true);
	});

	// root/
	// └── src/
	//     ├── .gitignore   (*.js - no slash, matches any depth)
	//     ├── foo/
	//     │   └── bar.js       ❌ ignored (matches at any depth)
	//     ├── nested/
	//     │   └── deep/
	//     │       └── test.js  ❌ ignored (matches at any depth)
	//     └── baz.js           ❌ ignored
	it("handles patterns without slash (match at any level)", () => {
		const srcDir = path.join(integrationRoot, "src");
		host.vfsUpsertFile(path.join(srcDir, ".gitignore"), "*.js");

		const directFile = path.join(srcDir, "baz.js");
		const nestedFile = path.join(srcDir, "foo", "bar.js");
		const deepFile = path.join(srcDir, "nested", "deep", "test.js");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(directFile)).toBe(false);
		expect(gitignoreFilter(nestedFile)).toBe(false);
		expect(gitignoreFilter(deepFile)).toBe(false);
	});

	// root/
	// ├── .gitignore   (build/)
	// ├── build/           ❌ ignored (directory)
	// │   └── output.js    ❌ ignored
	// ├── build.js         ✓ not ignored (file, not directory)
	// └── src/
	//     └── build/       ❌ ignored (matches at any depth because no leading/middle slash)
	it("handles trailing slash (directories only)", () => {
		host.vfsUpsertFile(path.join(integrationRoot, ".gitignore"), "build/");
		const buildDir = path.join(integrationRoot, "build", "output.js");
		const buildFile = path.join(integrationRoot, "build.js");
		const nestedBuildDir = path.join(
			integrationRoot,
			"src",
			"build",
			"file.js",
		);

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(buildDir)).toBe(false);
		expect(gitignoreFilter(buildFile)).toBe(true);
		expect(gitignoreFilter(nestedBuildDir)).toBe(false);
	});

	// root/
	// ├── .gitignore   (build/)
	// ├── build/           ❌ ignored
	// │   └── output.js    ❌ ignored
	// ├── build.js         ✓ not ignored (file, not directory)
	// └── src/
	//     └── build/      	❌ ignored
	it("handles trailing slash (directory only)", () => {
		host.vfsUpsertFile(path.join(integrationRoot, ".gitignore"), "build/");
		const buildDir = path.join(integrationRoot, "build", "output.js");
		const buildFile = path.join(integrationRoot, "build.js");
		const nestedBuildDir = path.join(
			integrationRoot,
			"src",
			"build",
			"file.js",
		);

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(buildDir)).toBe(false);
		expect(gitignoreFilter(buildFile)).toBe(true);
		expect(gitignoreFilter(nestedBuildDir)).toBe(false);
	});

	// root/
	// ├── .gitignore   (/build/)
	// ├── build/           ❌ ignored (anchored directory)
	// │   └── output.js    ❌ ignored
	// ├── build.js         ✓ not ignored (file, not directory)
	// └── src/
	//     └── build/       ✓ not ignored (/build/ is anchored to root only)
	it("handles leading and trailing slash (anchored directory)", () => {
		host.vfsUpsertFile(path.join(integrationRoot, ".gitignore"), "/build/");
		const buildDir = path.join(integrationRoot, "build", "output.js");
		const buildFile = path.join(integrationRoot, "build.js");
		const nestedBuildDir = path.join(
			integrationRoot,
			"src",
			"build",
			"file.js",
		);

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(buildDir)).toBe(false);
		expect(gitignoreFilter(buildFile)).toBe(true);
		expect(gitignoreFilter(nestedBuildDir)).toBe(true);
	});

	// root/
	// ├── .gitignore     (*.log, dist/)
	// ├── debug.log      ❌ ignored
	// ├── dist/
	// │   └── bundle.js  ❌ ignored
	// └── src/
	//     └── index.ts   ✓ not ignored
	it("handles asterisk wildcard", () => {
		host.vfsUpsertFile(
			path.join(integrationRoot, ".gitignore"),
			"*.log\ndist/",
		);
		const logFile = path.join(integrationRoot, "debug.log");
		const distFile = path.join(integrationRoot, "dist", "bundle.js");
		const srcFile = path.join(integrationRoot, "src", "index.ts");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(logFile)).toBe(false);
		expect(gitignoreFilter(distFile)).toBe(false);
		expect(gitignoreFilter(srcFile)).toBe(true);
	});

	// root/
	// ├── .gitignore   (test?.js, file[0-9].txt)
	// ├── test1.js         ❌ ignored (? matches one char)
	// ├── test2.js         ❌ ignored
	// ├── test.js          ✓ not ignored (? requires one char)
	// ├── test12.js        ✓ not ignored (? matches only one char)
	// ├── file1.txt        ❌ ignored (range [0-9])
	// ├── file5.txt        ❌ ignored
	// ├── fileA.txt        ✓ not ignored
	// └── other.js         ✓ not ignored
	it("handles wildcards and character ranges", () => {
		host.vfsUpsertFile(
			path.join(integrationRoot, ".gitignore"),
			"test?.js\nfile[0-9].txt",
		);
		const test1 = path.join(integrationRoot, "test1.js");
		const test2 = path.join(integrationRoot, "test2.js");
		const testNoChar = path.join(integrationRoot, "test.js");
		const testTwoChars = path.join(integrationRoot, "test12.js");
		const file1 = path.join(integrationRoot, "file1.txt");
		const file5 = path.join(integrationRoot, "file5.txt");
		const fileA = path.join(integrationRoot, "fileA.txt");
		const other = path.join(integrationRoot, "other.js");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(test1)).toBe(false);
		expect(gitignoreFilter(test2)).toBe(false);
		expect(gitignoreFilter(testNoChar)).toBe(true);
		expect(gitignoreFilter(testTwoChars)).toBe(true);
		expect(gitignoreFilter(file1)).toBe(false);
		expect(gitignoreFilter(file5)).toBe(false);
		expect(gitignoreFilter(fileA)).toBe(true);
		expect(gitignoreFilter(other)).toBe(true);
	});

	// root/
	// ├── .gitignore   (**/foo)
	// ├── foo              ❌ ignored
	// ├── bar/
	// │   └── foo          ❌ ignored
	// └── deep/
	//     └── nested/
	//         └── foo      ❌ ignored
	it("handles leading double asterisk pattern", () => {
		host.vfsUpsertFile(path.join(integrationRoot, ".gitignore"), "**/foo");
		const rootFoo = path.join(integrationRoot, "foo");
		const barFoo = path.join(integrationRoot, "bar", "foo");
		const deepFoo = path.join(integrationRoot, "deep", "nested", "foo");
		const otherFile = path.join(integrationRoot, "other.txt");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(rootFoo)).toBe(false);
		expect(gitignoreFilter(barFoo)).toBe(false);
		expect(gitignoreFilter(deepFoo)).toBe(false);
		expect(gitignoreFilter(otherFile)).toBe(true);
	});

	// root/
	// ├── .gitignore   (abc/**)
	// ├── abc/
	// │   ├── file.js      ❌ ignored
	// │   └── deep/
	// │       └── nested.js ❌ ignored
	// └── other.js         ✓ not ignored
	it("handles trailing double asterisk pattern", () => {
		host.vfsUpsertFile(path.join(integrationRoot, ".gitignore"), "abc/**");
		const abcFile = path.join(integrationRoot, "abc", "file.js");
		const abcDeep = path.join(integrationRoot, "abc", "deep", "nested.js");
		const otherFile = path.join(integrationRoot, "other.js");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(abcFile)).toBe(false);
		expect(gitignoreFilter(abcDeep)).toBe(false);
		expect(gitignoreFilter(otherFile)).toBe(true);
	});

	// root/
	// ├── .gitignore   (a/**/b)
	// ├── a/
	// │   ├── b            ❌ ignored (zero directories)
	// │   ├── x/
	// │   │   └── b        ❌ ignored (one directory)
	// │   └── x/
	// │       └── y/
	// │           └── b    ❌ ignored (two directories)
	// └── other            ✓ not ignored
	it("handles middle double asterisk pattern", () => {
		host.vfsUpsertFile(path.join(integrationRoot, ".gitignore"), "a/**/b");
		const aB = path.join(integrationRoot, "a", "b");
		const aXB = path.join(integrationRoot, "a", "x", "b");
		const aXYB = path.join(integrationRoot, "a", "x", "y", "b");
		const other = path.join(integrationRoot, "other");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(aB)).toBe(false);
		expect(gitignoreFilter(aXB)).toBe(false);
		expect(gitignoreFilter(aXYB)).toBe(false);
		expect(gitignoreFilter(other)).toBe(true);
	});

	// root/
	// ├── .gitignore       (*.log)
	// ├── root.log         ❌ ignored (root .gitignore)
	// └── src/
	//     ├── .gitignore   (temp/)
	//     ├── src.log      ❌ ignored (inherited from root .gitignore)
	//     ├── temp/
	//     │   └── cache.txt ❌ ignored (src/.gitignore)
	//     └── index.ts     ✓ not ignored
	it("handles nested .gitignore files", () => {
		host.vfsUpsertFile(path.join(integrationRoot, ".gitignore"), "*.log");
		const srcDir = path.join(integrationRoot, "src");
		host.vfsUpsertFile(path.join(srcDir, ".gitignore"), "temp/");

		const rootLog = path.join(integrationRoot, "root.log");
		const srcLog = path.join(srcDir, "src.log");
		const srcTemp = path.join(srcDir, "temp", "cache.txt");
		const srcFile = path.join(srcDir, "index.ts");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(rootLog)).toBe(false);
		expect(gitignoreFilter(srcLog)).toBe(false);
		expect(gitignoreFilter(srcTemp)).toBe(false);
		expect(gitignoreFilter(srcFile)).toBe(true);
	});

	// root/
	// └── src/
	//     ├── .gitignore         (*.generated.ts, !/keep.generated.ts)
	//     ├── api.generated.ts   ❌ ignored (matches *.generated.ts)
	//     └── keep.generated.ts  ✓ not ignored (negated with !/keep.generated.ts)
	it("handles negation with leading slash in subdirectory", () => {
		const srcDir = path.join(integrationRoot, "src");
		host.vfsUpsertFile(
			path.join(srcDir, ".gitignore"),
			"*.generated.ts\n!/keep.generated.ts",
		);

		const ignoredFile = path.join(srcDir, "api.generated.ts");
		const keptFile = path.join(srcDir, "keep.generated.ts");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(ignoredFile)).toBe(false);
		expect(gitignoreFilter(keptFile)).toBe(true);
	});

	// root/
	// └── src/
	//     ├── .gitignore   (dist - unanchored, matches at any depth)
	//     ├── dist/
	//     │   └── bundle.js        ❌ ignored
	//     └── nested/
	//         └── dist/
	//             └── bundle.js    ❌ ignored (matches at any depth)
	it("handles unanchored pattern in nested .gitignore (should match any depth)", () => {
		const srcDir = path.join(integrationRoot, "src");
		host.vfsUpsertFile(path.join(srcDir, ".gitignore"), "dist");

		const srcDist = path.join(srcDir, "dist", "bundle.js");
		const nestedDist = path.join(srcDir, "nested", "dist", "bundle.js");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(srcDist)).toBe(false);
		expect(gitignoreFilter(nestedDist)).toBe(false);
	});
});
