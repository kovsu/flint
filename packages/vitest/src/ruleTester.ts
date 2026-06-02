import { RuleTester } from "@flint.fyi/rule-tester";
import { createRuleTesterTSConfig } from "@flint.fyi/typescript-language";
import { describe, it } from "vitest";

const jestStyleAliases = `
declare const fdescribe: typeof import("vitest")["describe"];
declare const xdescribe: typeof import("vitest")["describe"];
declare const fit: typeof import("vitest")["it"];
declare const xit: typeof import("vitest")["it"];
declare const xtest: typeof import("vitest")["test"];
`;

export const ruleTester = new RuleTester({
	assertNoLanguageReports: true,
	defaults: {
		fileName: "file.ts",
		files: {
			...createRuleTesterTSConfig({
				types: ["vitest/globals", "node"],
			}),
			"jest-style-aliases.d.ts": jestStyleAliases,
		},
	},
	describe,
	diskBackedFSRoot: import.meta.dirname,
	it,
});
