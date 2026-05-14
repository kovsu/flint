import { getJsonNodeRange, jsonLanguage } from "@flint.fyi/json-language";
import { normalizeDirname } from "@flint.fyi/utils";
import { SyntaxKind } from "typescript";

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
				JsonSourceFile(node, { sourceFile }) {
					const repository = getPackagePropertyOfName(node, "repository");
					if (
						repository?.kind !== SyntaxKind.PropertyAssignment ||
						repository.initializer.kind !== SyntaxKind.ObjectLiteralExpression
					) {
						return;
					}

					const directory = repository.initializer.properties.find(
						(property) =>
							property.kind === SyntaxKind.PropertyAssignment &&
							property.name.kind === SyntaxKind.StringLiteral &&
							property.name.text === "directory",
					);

					if (
						directory?.kind !== SyntaxKind.PropertyAssignment ||
						directory.initializer.kind !== SyntaxKind.StringLiteral
					) {
						return;
					}

					const currentDirectory = context.host.getCurrentDirectory();
					const relativeFileName = sourceFile.fileName.slice(
						currentDirectory.length + (currentDirectory.endsWith("/") ? 0 : 1),
					);
					const expectedDirectory = normalizeDirname(relativeFileName);

					if (directory.initializer.text === expectedDirectory) {
						return;
					}

					const range = getJsonNodeRange(directory.initializer, sourceFile);

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
