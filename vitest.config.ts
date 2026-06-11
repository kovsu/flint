import { readdirSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			provider: "v8",
		},
		projects: readdirSync(path.join(import.meta.dirname, "packages")).map(
			(name) => ({
				test: {
					clearMocks: true,
					env: name === "e2e" ? { FORCE_COLOR: "1" } : {},
					include: ["**/src/**/*.test.ts", "**/tests/**/*.test.ts"],
					name,
					root: path.join(import.meta.dirname, "packages", name),
					setupFiles: [
						"console-fail-test/setup",
						"@flint.fyi/ts-patch/install-patch-hooks",
					],
					snapshotSerializers: name === "e2e" ? ["vitest-ansi-serializer"] : [],
					testTimeout: 10_000,
				},
			}),
		),
	},
});
