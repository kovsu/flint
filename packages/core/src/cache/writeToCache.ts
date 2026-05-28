import { CachedFactory } from "cached-factory";
import { debugForFile } from "debug-for-file";
import omitEmpty from "omit-empty";

import type { CacheStorage } from "../types/cache.ts";
import type { LinterHost } from "../types/host.ts";
import type { LintResults } from "../types/linting.ts";
import { cacheStorageSchema } from "./cacheSchema.ts";
import { getCacheFilePath } from "./getCacheFilePath.ts";

const log = debugForFile(import.meta.filename);

export async function writeToCache(
	host: LinterHost,
	configFileName: string,
	lintResults: LintResults,
	cacheLocation: string | undefined,
) {
	const fileDependents = new CachedFactory(() => new Set<string>());
	const timestamp = Date.now();

	for (const [filePath, fileResult] of lintResults.filesResults) {
		for (const dependency of fileResult.dependencies) {
			fileDependents.get(dependency).add(filePath);
		}
	}

	const storage: CacheStorage = {
		configs: {
			[configFileName]: await host.getFileTouchTime(configFileName),
			"package.json": await host.getFileTouchTime("package.json"),
		},
		files: {
			...Object.fromEntries(
				Array.from(lintResults.filesResults).map(([filePath, fileResults]) => [
					filePath,
					{
						...omitEmpty({
							dependencies: Array.from(fileResults.dependencies).sort(),
							languageReports: fileResults.languageReports,
							reports: fileResults.reports,
						}),
						timestamp,
					},
				]),
			),
			...(lintResults.cached &&
				Object.fromEntries(
					Array.from(lintResults.cached).filter(([filePath]) =>
						lintResults.allFilePaths.has(filePath),
					),
				)),
		},
	};

	const encoded = cacheStorageSchema.safeEncode(storage);
	if (!encoded.success) {
		log("Failed to encode cache data: %s", encoded.error.message);
		return;
	}

	const cacheFilePath = getCacheFilePath(cacheLocation);
	await host.writeFile(cacheFilePath, encoded.data);
}
