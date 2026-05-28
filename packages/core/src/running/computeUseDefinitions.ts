import { normalizePath } from "@flint.fyi/utils";
import { debugForFile } from "debug-for-file";
import path from "node:path";
import picomatch from "picomatch";

import { commonlyIgnoredPaths } from "../host/watcher.ts";
import type {
	ConfigRuleDefinition,
	ConfigUseDefinition,
	ProcessedConfigDefinition,
} from "../types/configs.ts";
import type { LinterHost } from "../types/host.ts";
import { flatten } from "../utils/arrays.ts";
import { createGitignoreFilter } from "./createGitignoreFilter.ts";
import { resolveUseFilesGlobs } from "./resolveUseFilesGlobs.ts";

const log = debugForFile(import.meta.filename);

export interface ComputedUseDefinitions {
	allFilePaths: Set<string>;
	useDefinitions: ConfigUseDefinitionWithFiles[];
}

export interface ConfigUseDefinitionWithFiles extends ConfigUseDefinition {
	found: Set<string>;
	rules: ConfigRuleDefinition[];
}

export async function computeUseDefinitions(
	host: LinterHost,
	configDefinition: ProcessedConfigDefinition,
): Promise<ComputedUseDefinitions> {
	log("Collecting files from %d use pattern(s)", configDefinition.use.length);

	const cwd = host.getCurrentDirectory();
	const gitignoreFilter = createGitignoreFilter(cwd, host);
	const candidateFilePaths = await collectCandidateFilePaths(
		host,
		cwd,
		gitignoreFilter,
	);

	const allFilePaths = new Set<string>();

	const useDefinitions = configDefinition.use.map((use) => {
		const globs = resolveUseFilesGlobs(use.files, configDefinition);
		const isIncluded = picomatch(globs.include);
		const isExcluded = createExcludeMatcher(globs.exclude);

		const found = new Set<string>();
		for (const filePathAbsolute of candidateFilePaths) {
			const filePathRelative = path.posix.relative(cwd, filePathAbsolute);
			if (isIncluded(filePathRelative) && !isExcluded?.(filePathRelative)) {
				found.add(filePathAbsolute);
				allFilePaths.add(filePathAbsolute);
			}
		}

		return {
			...use,
			found,
			rules: flatten(use.rules),
		};
	});

	return { allFilePaths, useDefinitions };
}

async function collectCandidateFilePaths(
	host: LinterHost,
	cwd: string,
	gitignoreFilter: (filePathAbsolute: string) => boolean,
) {
	const prunedDirectoryNames = new Set(
		commonlyIgnoredPaths.map((dir) => dir.slice(1)),
	);
	const found: string[] = [];

	async function walk(directoryPathAbsolute: string): Promise<void> {
		const entries = await host.readDirectory(directoryPathAbsolute);

		await Promise.all(
			entries.map(async (entry) => {
				const entryPathAbsolute = normalizePath(
					path.posix.join(directoryPathAbsolute, entry.name),
				);

				if (entry.type === "directory") {
					// Don't follow symlinked directories, matching node:fs glob;
					// otherwise files are discovered twice (real + link path) and
					// symlink cycles can hang the walk.
					if (
						entry.isSymbolicLink ||
						prunedDirectoryNames.has(entry.name) ||
						!gitignoreFilter(entryPathAbsolute)
					) {
						return;
					}
					await walk(entryPathAbsolute);
				} else if (gitignoreFilter(entryPathAbsolute)) {
					found.push(entryPathAbsolute);
				}
			}),
		);
	}

	await walk(cwd);

	return found;
}

function createExcludeMatcher(patterns: string[]) {
	if (!patterns.length) {
		return undefined;
	}

	const withDescendants = patterns.flatMap((pattern) => {
		const base = pattern.replace(/\/+$/, "");
		return [base, `${base}/**`];
	});

	return picomatch(withDescendants);
}
