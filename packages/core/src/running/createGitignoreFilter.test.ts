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
	// ├── .gitignore     (*.log, dist/)
	// ├── debug.log      ❌ ignored
	// ├── dist/
	// │   └── bundle.js  ❌ ignored
	// └── src/
	//     └── index.ts   ✓ not ignored
	it("filters files matching root .gitignore patterns", () => {
		host.vfsUpsertFile(
			path.join(integrationRoot, ".gitignore"),
			"*.log\ndist/",
		);
		const logFile = path.join(integrationRoot, "debug.log");
		const distFile = path.join(integrationRoot, "dist", "bundle.js");
		const srcFile = path.join(integrationRoot, "src", "index.ts");

		host.vfsUpsertFile(logFile, "log content");
		host.vfsUpsertFile(distFile, "bundle content");
		host.vfsUpsertFile(srcFile, "source content");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(logFile)).toBe(false);
		expect(gitignoreFilter(distFile)).toBe(false);
		expect(gitignoreFilter(srcFile)).toBe(true);
	});

	// root/
	// ├── .gitignore       (*.log, !important.log)
	// ├── debug.log        ❌ ignored
	// └── important.log    ✓ not ignored (negated)
	it("handles negation patterns", () => {
		host.vfsUpsertFile(
			path.join(integrationRoot, ".gitignore"),
			"*.log\n!important.log",
		);
		const debugLog = path.join(integrationRoot, "debug.log");
		const importantLog = path.join(integrationRoot, "important.log");

		host.vfsUpsertFile(debugLog, "debug");
		host.vfsUpsertFile(importantLog, "important");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(debugLog)).toBe(false);
		expect(gitignoreFilter(importantLog)).toBe(true);
	});

	// root/
	// └── src/
	//     ├── .gitignore       (dist)
	//     ├── dist/
	//     │   └── bundle.js    ❌ ignored
	//     └── nested/
	//         └── dist/
	//             └── bundle.js ❌ ignored
	it("handles unanchored pattern in nested .gitignore (should match any depth)", () => {
		const srcDir = path.join(integrationRoot, "src");
		host.vfsUpsertFile(path.join(srcDir, ".gitignore"), "dist");

		const srcDist = path.join(srcDir, "dist", "bundle.js");
		const nestedDist = path.join(srcDir, "nested", "dist", "bundle.js");

		host.vfsUpsertFile(srcDist, "bundle");
		host.vfsUpsertFile(nestedDist, "nested bundle");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(srcDist)).toBe(false);
		expect(gitignoreFilter(nestedDist)).toBe(false);
	});

	// root/
	// ├── .gitignore         (/build)
	// ├── build/
	// │   └── output.js      ❌ ignored (root /build)
	// └── src/
	//     ├── build
	//     │   └── output.js  ✓ not ignored
	//     └── index.ts       ✓ not ignored
	it("handles absolute path patterns with leading slash", () => {
		host.vfsUpsertFile(path.join(integrationRoot, ".gitignore"), "/build");
		const rootBuild = path.join(integrationRoot, "build", "output.js");
		const srcFile = path.join(integrationRoot, "src", "index.ts");
		const srcBuild = path.join(integrationRoot, "src", "build", "output.js");

		host.vfsUpsertFile(rootBuild, "root build");
		host.vfsUpsertFile(srcFile, "source");
		host.vfsUpsertFile(srcBuild, "src build");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(rootBuild)).toBe(false);
		expect(gitignoreFilter(srcFile)).toBe(true);
		expect(gitignoreFilter(srcBuild)).toBe(true);
	});

	// root/
	// ├── .gitignore       (*.log)
	// ├── root.log         ❌ ignored
	// └── src/
	//     ├── .gitignore   (temp/)
	//     ├── src.log      ❌ ignored (from root)
	//     ├── index.ts     ✓ not ignored
	//     └── temp/
	//         └── cache.txt ❌ ignored (from src/.gitignore)
	it("handles nested .gitignore files", () => {
		host.vfsUpsertFile(path.join(integrationRoot, ".gitignore"), "*.log");
		const srcDir = path.join(integrationRoot, "src");
		host.vfsUpsertFile(path.join(srcDir, ".gitignore"), "temp/");

		const rootLog = path.join(integrationRoot, "root.log");
		const srcLog = path.join(srcDir, "src.log");
		const srcTemp = path.join(srcDir, "temp", "cache.txt");
		const srcFile = path.join(srcDir, "index.ts");

		host.vfsUpsertFile(rootLog, "root log");
		host.vfsUpsertFile(srcLog, "src log");
		host.vfsUpsertFile(srcTemp, "cache");
		host.vfsUpsertFile(srcFile, "source");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(rootLog)).toBe(false);
		expect(gitignoreFilter(srcLog)).toBe(false);
		expect(gitignoreFilter(srcTemp)).toBe(false);
		expect(gitignoreFilter(srcFile)).toBe(true);
	});

	// root/
	// └── src/
	//     ├── .gitignore          (*.generated.ts, !/keep.generated.ts)
	//     ├── api.generated.ts    ❌ ignored
	//     └── keep.generated.ts   ✓ not ignored (negated)
	it("handles negation with leading slash in subdirectory", () => {
		const srcDir = path.join(integrationRoot, "src");
		host.vfsUpsertFile(
			path.join(srcDir, ".gitignore"),
			"*.generated.ts\n!/keep.generated.ts",
		);

		const ignoredFile = path.join(srcDir, "api.generated.ts");
		const keptFile = path.join(srcDir, "keep.generated.ts");

		host.vfsUpsertFile(ignoredFile, "generated");
		host.vfsUpsertFile(keptFile, "keep");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(ignoredFile)).toBe(false);
		expect(gitignoreFilter(keptFile)).toBe(true);
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

		host.vfsUpsertFile(logFile, "log");
		host.vfsUpsertFile(tsFile, "source");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(logFile)).toBe(false);
		expect(gitignoreFilter(tsFile)).toBe(true);
	});

	// root/
	// ├── .gitignore   (file\ with\ space\ )
	// ├── file with space     ❌ ignored (matched by escaped trailing space pattern)
	// ├── file with space .js ✓ not ignored
	// └── normal.txt          ✓ not ignored
	it("handles escaped trailing spaces", () => {
		host.vfsUpsertFile(
			path.join(integrationRoot, ".gitignore"),
			"file\\ with\\ space\\ ",
		);
		const fileWithSpace = path.join(integrationRoot, "file with space ");
		const fileWithSpaceJs = path.join(integrationRoot, "file with space .js");
		const normalFile = path.join(integrationRoot, "normal.txt");

		host.vfsUpsertFile(fileWithSpace, "content");
		host.vfsUpsertFile(fileWithSpaceJs, "content");
		host.vfsUpsertFile(normalFile, "content");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(fileWithSpace)).toBe(false);
		expect(gitignoreFilter(fileWithSpaceJs)).toBe(true);
		expect(gitignoreFilter(normalFile)).toBe(true);
	});

	// root/
	// ├── .gitignore   (  *.log with leading spaces)
	// ├── test.log         ✓ not ignored (leading spaces prevent matching)
	// ├──  test.log         ❌ ignored (matched by escaped leading space pattern)
	// └── test.txt         ✓ not ignored
	it("treats leading spaces as part of the pattern", () => {
		host.vfsUpsertFile(path.join(integrationRoot, ".gitignore"), "  *.log");
		const logFile = path.join(integrationRoot, "test.log");
		const logFileWithSpaces = path.join(integrationRoot, "  test.log");
		const txtFile = path.join(integrationRoot, "test.txt");

		host.vfsUpsertFile(logFile, "content");
		host.vfsUpsertFile(logFileWithSpaces, "content");
		host.vfsUpsertFile(txtFile, "content");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(logFile)).toBe(true);
		expect(gitignoreFilter(logFileWithSpaces)).toBe(false);
		expect(gitignoreFilter(txtFile)).toBe(true);
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

		host.vfsUpsertFile(directMatch, "content");
		host.vfsUpsertFile(nestedMatch, "content");
		host.vfsUpsertFile(otherFile, "content");

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
	it("handles patterns without slash", () => {
		const srcDir = path.join(integrationRoot, "src");
		host.vfsUpsertFile(path.join(srcDir, ".gitignore"), "*.js");

		const directFile = path.join(srcDir, "baz.js");
		const nestedFile = path.join(srcDir, "foo", "bar.js");
		const deepFile = path.join(srcDir, "nested", "deep", "test.js");

		host.vfsUpsertFile(directFile, "content");
		host.vfsUpsertFile(nestedFile, "content");
		host.vfsUpsertFile(deepFile, "content");

		const gitignoreFilter = createGitignoreFilter(integrationRoot, host);
		expect(gitignoreFilter(directFile)).toBe(false);
		expect(gitignoreFilter(nestedFile)).toBe(false);
		expect(gitignoreFilter(deepFile)).toBe(false);
	});
});
