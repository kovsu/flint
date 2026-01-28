import { makeAbsolute } from "@flint.fyi/utils";
import ignore from "ignore";
import fs from "node:fs";
import path from "node:path";

export function createGitignoreFilter() {
	const ig = ignore();
	const visited = new Set();
	const rootDir = process.cwd();

	function loadDir(dir: string): void {
		if (visited.has(dir) || !dir.startsWith(rootDir)) {
			return;
		}

		const parent = path.dirname(dir);
		if (parent !== dir) {
			loadDir(parent);
		}
		visited.add(dir);

		const gitignorePath = path.join(dir, ".gitignore");
		if (!fs.existsSync(gitignorePath)) {
			return;
		}

		const prefix = path.relative(rootDir, dir);
		// Should we use readFileSafe here?
		// We should use readFileSync to avoid async operations.
		const content = fs.readFileSync(gitignorePath, "utf-8");

		const rules = content
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"))
			.map((rule) => {
				const negated = rule.startsWith("!");
				const pattern = negated ? rule.slice(1) : rule;

				if (pattern.startsWith("/")) {
					const relativePath = prefix ? `${prefix}${pattern}` : pattern;
					return negated ? `!${relativePath}` : relativePath;
				}

				if (prefix) {
					return negated ? `!${prefix}/${pattern}` : `${prefix}/${pattern}`;
				}

				return rule;
			});

		ig.add(rules);
	}

	return (filePath: string) => {
		loadDir(path.dirname(makeAbsolute(filePath)));
		return !ig.ignores(path.relative(rootDir, filePath));
	};
}

export const gitignoreFilter = createGitignoreFilter();
