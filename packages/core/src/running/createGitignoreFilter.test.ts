import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGitignoreFilter } from "./createGitignoreFilter.ts";

const INTEGRATION_DIR_NAME = ".flint-gitignore-filter-integration-tests";

function findUpNodeModules(startDir: string): string {
	let current = startDir;
	while (true) {
		const candidate = path.join(current, "node_modules");
		if (fs.existsSync(candidate)) {
			return candidate;
		}
		const parent = path.dirname(current);
		if (parent === current) {
			throw new Error("Could not find node_modules directory.");
		}
		current = parent;
	}
}

describe("createGitignoreFilter", () => {
	const integrationRoot = path.join(
		findUpNodeModules(import.meta.dirname),
		INTEGRATION_DIR_NAME,
	);

	beforeEach(() => {
		fs.rmSync(integrationRoot, { force: true, recursive: true });
		fs.mkdirSync(integrationRoot, { recursive: true });
		vi.stubGlobal("process", { ...process, cwd: () => integrationRoot });
	});

	afterEach(() => {
		fs.rmSync(integrationRoot, { force: true, recursive: true });
		vi.unstubAllGlobals();
	});

	// root/
	// └── src/
	//     └── file.ts
	it("returns true for files when no .gitignore exists", () => {
		const filePath = path.join(integrationRoot, "src", "file.ts");
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, "content");

		const gitignoreFilter = createGitignoreFilter();
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
		fs.writeFileSync(path.join(integrationRoot, ".gitignore"), "*.log\ndist/");
		const logFile = path.join(integrationRoot, "debug.log");
		const distFile = path.join(integrationRoot, "dist", "bundle.js");
		const srcFile = path.join(integrationRoot, "src", "index.ts");

		fs.writeFileSync(logFile, "log content");
		fs.mkdirSync(path.dirname(distFile), { recursive: true });
		fs.writeFileSync(distFile, "bundle content");
		fs.mkdirSync(path.dirname(srcFile), { recursive: true });
		fs.writeFileSync(srcFile, "source content");

		const gitignoreFilter = createGitignoreFilter();
		expect(gitignoreFilter(logFile)).toBe(false);
		expect(gitignoreFilter(distFile)).toBe(false);
		expect(gitignoreFilter(srcFile)).toBe(true);
	});

	// root/
	// ├── .gitignore       (*.log, !important.log)
	// ├── debug.log        ❌ ignored
	// └── important.log    ✓ not ignored (negated)
	it("handles negation patterns", () => {
		fs.writeFileSync(
			path.join(integrationRoot, ".gitignore"),
			"*.log\n!important.log",
		);
		const debugLog = path.join(integrationRoot, "debug.log");
		const importantLog = path.join(integrationRoot, "important.log");

		fs.writeFileSync(debugLog, "debug");
		fs.writeFileSync(importantLog, "important");

		const gitignoreFilter = createGitignoreFilter();
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
		fs.mkdirSync(srcDir, { recursive: true });
		fs.writeFileSync(path.join(srcDir, ".gitignore"), "dist");

		const srcDist = path.join(srcDir, "dist", "bundle.js");
		const nestedDist = path.join(srcDir, "nested", "dist", "bundle.js");

		fs.mkdirSync(path.dirname(srcDist), { recursive: true });
		fs.writeFileSync(srcDist, "bundle");
		fs.mkdirSync(path.dirname(nestedDist), { recursive: true });
		fs.writeFileSync(nestedDist, "nested bundle");

		const gitignoreFilter = createGitignoreFilter();
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
		fs.writeFileSync(path.join(integrationRoot, ".gitignore"), "/build");
		const rootBuild = path.join(integrationRoot, "build", "output.js");
		const srcFile = path.join(integrationRoot, "src", "index.ts");
		const srcBuild = path.join(integrationRoot, "src", "build", "output.js");

		fs.mkdirSync(path.dirname(rootBuild), { recursive: true });
		fs.writeFileSync(rootBuild, "root build");
		fs.mkdirSync(path.dirname(srcFile), { recursive: true });
		fs.writeFileSync(srcFile, "source");

		fs.mkdirSync(path.dirname(srcBuild), { recursive: true });
		fs.writeFileSync(srcBuild, "src build");

		const gitignoreFilter = createGitignoreFilter();
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
		fs.writeFileSync(path.join(integrationRoot, ".gitignore"), "*.log");
		const srcDir = path.join(integrationRoot, "src");
		fs.mkdirSync(srcDir, { recursive: true });
		fs.writeFileSync(path.join(srcDir, ".gitignore"), "temp/");

		const rootLog = path.join(integrationRoot, "root.log");
		const srcLog = path.join(srcDir, "src.log");
		const srcTemp = path.join(srcDir, "temp", "cache.txt");
		const srcFile = path.join(srcDir, "index.ts");

		fs.writeFileSync(rootLog, "root log");
		fs.writeFileSync(srcLog, "src log");
		fs.mkdirSync(path.dirname(srcTemp), { recursive: true });
		fs.writeFileSync(srcTemp, "cache");
		fs.writeFileSync(srcFile, "source");

		const gitignoreFilter = createGitignoreFilter();
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
		fs.mkdirSync(srcDir, { recursive: true });
		fs.writeFileSync(
			path.join(srcDir, ".gitignore"),
			"*.generated.ts\n!/keep.generated.ts",
		);

		const ignoredFile = path.join(srcDir, "api.generated.ts");
		const keptFile = path.join(srcDir, "keep.generated.ts");

		fs.writeFileSync(ignoredFile, "generated");
		fs.writeFileSync(keptFile, "keep");

		const gitignoreFilter = createGitignoreFilter();
		expect(gitignoreFilter(ignoredFile)).toBe(false);
		expect(gitignoreFilter(keptFile)).toBe(true);
	});

	// root/
	// ├── .gitignore   (# comment, *.log, # comment)
	// ├── debug.log    ❌ ignored
	// └── index.ts     ✓ not ignored
	it("ignores comments and empty lines", () => {
		fs.writeFileSync(
			path.join(integrationRoot, ".gitignore"),
			"# This is a comment\n\n*.log\n   \n# Another comment",
		);
		const logFile = path.join(integrationRoot, "debug.log");
		const tsFile = path.join(integrationRoot, "index.ts");

		fs.writeFileSync(logFile, "log");
		fs.writeFileSync(tsFile, "source");

		const gitignoreFilter = createGitignoreFilter();
		expect(gitignoreFilter(logFile)).toBe(false);
		expect(gitignoreFilter(tsFile)).toBe(true);
	});
});
