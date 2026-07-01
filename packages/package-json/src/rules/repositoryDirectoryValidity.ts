import { getNodeRange, jsonLanguage } from "@flint.fyi/json-language";
import { normalizeDirname } from "@flint.fyi/utils";

import { getPackagePropertyOfName } from "../getPackagePropertyOfName.ts";
import { ruleCreator } from "../ruleCreator.ts";

export default ruleCreator.createRule(jsonLanguage, {
	about: {
		description:
			"Enforce that repository.directory matches the package.json file directory.",
		id: "repositoryDirectoryValidity",
		presets: ["logical"],
	},
	messages: {
		mismatchedDirectory: {
			primary:
				"The repository directory should match this package.json file's directory.",
			secondary: [
				"The package.json repository.directory field points from the repository root to the package's folder.",
			],
			suggestions: ["Replace with the path to this package.json file."],
		},
	},
	setup(context) {
		return {
			visitors: {
				Document(node, { filePath, filePathAbsolute }) {
					const repository = getPackagePropertyOfName(node, "repository");
					if (repository?.value.type !== "Object") {
						return;
					}

					const directory = repository.value.members.find(
						(property) =>
							property.name.type === "String" &&
							property.name.value === "directory",
					);

					if (directory?.value.type !== "String") {
						return;
					}

					const repositoryRoot = context.host.getRepositoryRoot();
					const repositoryDirectory = directory.value.value;

					if (!repositoryRoot) {
						const fileDirectory = normalizeDirname(filePath);
						if (
							repositoryDirectory === fileDirectory ||
							fileDirectory.endsWith(`/${repositoryDirectory}`)
						) {
							return;
						}

						context.report({
							message: "mismatchedDirectory",
							range: getNodeRange(directory.value),
						});
						return;
					}

					const fileDirectory = normalizeDirname(filePathAbsolute);
					const expectedDirectory = fileDirectory.slice(
						repositoryRoot.length + 1,
					);

					if (repositoryDirectory === expectedDirectory) {
						return;
					}

					const range = getNodeRange(directory.value);

					context.report({
						message: "mismatchedDirectory",
						range,
						suggestions: [
							{
								id: "replaceRepositoryDirectory",
								range,
								text: JSON.stringify(expectedDirectory),
							},
						],
					});
				},
			},
		};
	},
});
