import util from "node:util";

import { runCli } from "@flint.fyi/cli";
import { normalizePath } from "@flint.fyi/utils";

declare global {
	// TODO[typescript>=6.0]: Remove this declaration.
	// https://github.com/microsoft/TypeScript/pull/63046
	export interface RegExpConstructor {
		/**
		 * Escapes any RegExp syntax characters in the input string, returning a
		 * new string that can be safely interpolated into a RegExp as a literal
		 * string to match.
		 * @example
		 * ```ts
		 * const regExp = new RegExp(RegExp.escape("foo.bar"));
		 * regExp.test("foo.bar"); // true
		 * regExp.test("foo!bar"); // false
		 * ```
		 */
		escape(string: string): string;
	}
}

/**
 * Normalizes CLI output for snapshot testing: converts backslashes to forward
 * slashes and replaces the given cwd with `&lt;cwd&gt;` so snapshots are portable.
 */
export function normalizeOutput(stdout: string, cwd: string): string {
	const normalizedCwd = normalizePath(cwd);

	return stdout
		.replace(/\\/g, "/")
		.replace(new RegExp(RegExp.escape(normalizedCwd), "gi"), "<cwd>")
		.replace(/Finished in \S+/g, "Finished in <time>");
}

/**
 * Runs the flint CLI in-process, capturing its stdout.
 * Color output comes from the e2e Vitest project's FORCE_COLOR env.
 */
export async function runFlint(cwd: string, args: string[] = []) {
	const previousCwd = process.cwd();
	const originalWrite = process.stdout.write.bind(process.stdout);
	const originalLog = console.log;
	const chunks: string[] = [];

	process.chdir(cwd);
	process.stdout.write = (chunk) => {
		chunks.push(String(chunk));
		return true;
	};
	console.log = (...args: unknown[]) => {
		chunks.push(`${util.format(...args)}\n`);
	};

	try {
		const exitCode = await runCli(args);
		return { exitCode, stdout: chunks.join("") };
	} finally {
		process.stdout.write = originalWrite;
		console.log = originalLog;
		process.chdir(previousCwd);
	}
}
