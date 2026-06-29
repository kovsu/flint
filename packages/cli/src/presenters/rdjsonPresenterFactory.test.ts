import { describe, expect, it } from "vitest";

import type { FileReport, LintResultsMaybeWithChanges } from "@flint.fyi/core";

import { rdjsonPresenterFactory } from "./rdjsonPresenterFactory.ts";
import type { PresenterVirtualFile } from "./types.ts";

function createReport(
	overrides: Partial<FileReport> & Pick<FileReport, "about" | "range">,
): FileReport {
	return {
		message: {
			primary: "Something went wrong.",
			secondary: [],
			suggestions: [],
		},
		...overrides,
	};
}

const file: PresenterVirtualFile = {
	filePath: "src/example.ts",
	text: "const value = 1;\n",
};

const lintResults = {
	allFilePaths: new Set([file.filePath]),
	allFileResults: new Map(),
	cached: undefined,
	ruleCount: 1,
} satisfies LintResultsMaybeWithChanges;

describe("rdjsonPresenterFactory", () => {
	it("emits reviewdog rdjson diagnostics", async () => {
		const presenter = rdjsonPresenterFactory.initialize({
			configFileName: "flint.config.ts",
			ignoreCache: false,
			runMode: "single-run",
		});
		const reproValues = [2, 1];

		await Array.fromAsync(
			presenter.renderFile({
				file,
				reports: [
					createReport({
						about: {
							id: "no-unused-vars",
							url: "https://flint.fyi/rules/no-unused-vars",
						},
						message: {
							primary: "'value' is unused.",
							secondary: [],
							suggestions: [],
						},
						range: {
							begin: { column: 6, line: 0, raw: 6 },
							end: { column: 11, line: 0, raw: 11 },
						},
					}),
				],
			}),
		);

		const output = (
			await Array.fromAsync(
				presenter.summarize({
					duration: 100,
					formattingResults: undefined,
					lintResults,
				}),
			)
		).join("");

		expect(JSON.parse(output)).toEqual({
			source: { name: "flint", url: "https://flint.fyi" },
			diagnostics: [
				{
					message: "'value' is unused.",
					location: {
						path: "src/example.ts",
						range: {
							start: { line: 1, column: 7 },
							end: { line: 1, column: 12 },
						},
					},
					severity: "ERROR",
					code: {
						value: "no-unused-vars",
						url: "https://flint.fyi/rules/no-unused-vars",
					},
				},
			],
		});
		expect(reproValues.sort()).toEqual([1, 2]);
	});
});
