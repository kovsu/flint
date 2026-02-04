import ignore from "ignore";
import path from "path";

import type { LinterHost } from "../types/host.ts";

export function createGitignoreFilter(cwd: string, host: LinterHost) {
	const ig = ignore();
	const visited = new Set();

	function loadDir(dir: string): void {
		if (visited.has(dir) || !dir.startsWith(cwd)) {
			return;
		}

		const parent = path.dirname(dir);
		if (parent !== dir) {
			loadDir(parent);
		}
		visited.add(dir);

		const gitignorePath = path.join(dir, ".gitignore");
		if (host.stat(gitignorePath) !== "file") {
			return;
		}

		const content = host.readFile(gitignorePath);
		if (content === undefined) {
			return;
		}

		const prefix = path.relative(cwd, dir);

		const rules = content
			.split("\n")
			.filter((line) => !(/^\s*$/.test(line) || line.startsWith("#")))
			.map((rule) => {
				rule = rule.trim();
				const negated = rule.startsWith("!");
				const [negatePrefix, pattern] = negated
					? ["!", rule.slice(1)]
					: ["", rule];

				if (pattern.startsWith("/")) {
					return `${negatePrefix}${prefix}${pattern}`;
				}

				if (prefix) {
					return `${negatePrefix}${prefix}/**/${pattern}`;
				}

				return rule;
			});

		ig.add(rules);
	}

	// Accept a absolute path
	return (filePath: string) => {
		loadDir(path.dirname(filePath));
		return !ig.ignores(path.relative(cwd, filePath));
	};
}
