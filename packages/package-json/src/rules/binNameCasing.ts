import { getJsonNodeRange, jsonLanguage } from "@flint.fyi/json-language";
import { kebabCase } from "change-case";
import ts from "typescript";

import { getPackagePropertiesOfNames } from "../getPackagePropertiesOfNames.ts";
import { ruleCreator } from "../ruleCreator.ts";

const binPropertyNames = new Set(["bin"]);

export default ruleCreator.createRule(jsonLanguage, {
	about: {
		description: "Enforce that names for bin properties are in kebab case.",
		id: "binNameCasing",
		presets: ["stylistic"],
	},
	messages: {
		invalidCase: {
			primary: "Prefer the standard kebab-case style for `bin` commands.",
			secondary: [
				"The keys in an object-form package.json `bin` field become command names for installed package executables.",
				"Kebab-case command names are the standard convention for CLI executables.",
			],
			suggestions: ["Convert the command name to kebab case."],
		},
	},
	setup(context) {
		return {
			visitors: {
				JsonSourceFile(node, { sourceFile }) {
					for (const initializer of getPackagePropertiesOfNames(
						node,
						binPropertyNames,
					)) {
						if (initializer.kind !== ts.SyntaxKind.ObjectLiteralExpression) {
							continue;
						}

						for (const binProperty of initializer.properties) {
							if (
								binProperty.kind !== ts.SyntaxKind.PropertyAssignment ||
								binProperty.name.kind !== ts.SyntaxKind.StringLiteral
							) {
								continue;
							}

							const propertyName = binProperty.name.text;
							const kebabCasePropertyName = kebabCase(propertyName);

							if (propertyName === kebabCasePropertyName) {
								continue;
							}

							const range = getJsonNodeRange(binProperty.name, sourceFile);

							context.report({
								message: "invalidCase",
								range,
								suggestions: [
									{
										id: "convertToKebabCase",
										range,
										text: JSON.stringify(kebabCasePropertyName),
									},
								],
							});
						}
					}
				},
			},
		};
	},
});
