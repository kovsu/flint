import {
	type AST,
	getTSNodeRange,
	typescriptLanguage,
} from "@flint.fyi/typescript-language";
import { SyntaxKind } from "typescript";

import {
	findMessagesProperty,
	forEachMessageString,
	isRuleCreatorCreateRule,
} from "../utils/ruleCreatorHelpers.ts";
import { ruleCreator } from "./ruleCreator.ts";

function extractPlaceholders(text: string): Set<string> {
	const placeholders = new Set<string>();
	for (const match of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
		if (match[1]) {
			placeholders.add(match[1]);
		}
	}
	return placeholders;
}

function isRuleContextReport(
	node: AST.CallExpression,
	typeChecker: import("typescript").TypeChecker,
): boolean {
	if (node.expression.kind !== SyntaxKind.PropertyAccessExpression) {
		return false;
	}

	const propertyAccess = node.expression;
	const type = typeChecker.getTypeAtLocation(propertyAccess.expression);
	const typeName = type.getSymbol()?.getName();

	return typeName === "RuleContext" && propertyAccess.name.text === "report";
}

export default ruleCreator.createRule(typescriptLanguage, {
	about: {
		description:
			"Reports `context.report()` calls missing data for message placeholders.",
		id: "missingPlaceholders",
		presets: ["logical"],
	},
	messages: {
		missingPlaceholders: {
			primary: "Message template requires placeholders in the data object.",
			secondary: [
				"Message templates use `{{ placeholder }}` that must be provided via the data property.",
				"Each placeholder in the message template requires a corresponding key in the data object.",
			],
			suggestions: ["Add a data object with the required placeholder keys."],
		},
	},
	setup(context) {
		const messagePlaceholders = new Map<string, Set<string>>();

		function checkMessageInCreateRule(ruleCreatorNode: AST.CallExpression) {
			const messagesProperty = findMessagesProperty(ruleCreatorNode);
			if (!messagesProperty) {
				return;
			}

			forEachMessageString(messagesProperty, (stringNode, ctx) => {
				const placeholders = extractPlaceholders(stringNode.text);
				if (placeholders.size) {
					const existing = messagePlaceholders.get(ctx.messageId);
					if (existing) {
						for (const p of placeholders) {
							existing.add(p);
						}
					} else {
						messagePlaceholders.set(ctx.messageId, placeholders);
					}
				}
			});
		}

		function populateMessageInCreateRule(
			contextNode: AST.CallExpression,
			sourceFile: AST.SourceFile,
		) {
			const args = contextNode.arguments[0];
			if (args?.kind !== SyntaxKind.ObjectLiteralExpression) {
				return;
			}

			const properties = args.properties;
			const messageProperty = properties.find((prop) => {
				return (
					prop.kind === SyntaxKind.PropertyAssignment &&
					prop.name.kind === SyntaxKind.Identifier &&
					prop.name.text === "message"
				);
			});

			if (
				messageProperty?.kind !== SyntaxKind.PropertyAssignment ||
				messageProperty.initializer.kind !== SyntaxKind.StringLiteral
			) {
				return;
			}

			const requiredPlaceholders = messagePlaceholders.get(
				messageProperty.initializer.text,
			);
			if (!requiredPlaceholders?.size) {
				return;
			}

			const dataProperty = properties.find((prop) => {
				return (
					prop.kind === SyntaxKind.PropertyAssignment &&
					prop.name.kind === SyntaxKind.Identifier &&
					prop.name.text === "data"
				);
			});
			if (!dataProperty) {
				context.report({
					data: {
						placeholder: Array.from(requiredPlaceholders).join(", "),
					},
					message: "missingPlaceholders",
					range: getTSNodeRange(messageProperty, sourceFile),
				});
				return;
			}

			if (
				dataProperty.kind !== SyntaxKind.PropertyAssignment ||
				dataProperty.initializer.kind !== SyntaxKind.ObjectLiteralExpression
			) {
				return;
			}

			const dataKeys = new Set<string>();
			dataProperty.initializer.properties.forEach((prop) => {
				if (
					prop.kind === SyntaxKind.PropertyAssignment &&
					prop.name.kind === SyntaxKind.Identifier
				) {
					dataKeys.add(prop.name.text);
				} else if (prop.kind === SyntaxKind.ShorthandPropertyAssignment) {
					dataKeys.add(prop.name.text);
				}
			});

			const missingPlaceholders = new Set<string>();
			for (const placeholder of requiredPlaceholders) {
				if (!dataKeys.has(placeholder)) {
					missingPlaceholders.add(placeholder);
				}
			}

			if (missingPlaceholders.size) {
				context.report({
					data: {
						placeholder: Array.from(missingPlaceholders).join(", "),
					},
					message: "missingPlaceholders",
					range: getTSNodeRange(messageProperty, sourceFile),
				});
			}
		}

		return {
			visitors: {
				CallExpression(node, { sourceFile, typeChecker }) {
					// TODO: Maybe need to check it more strictly
					// https://github.com/flint-fyi/flint/issues/152
					if (isRuleCreatorCreateRule(node, typeChecker)) {
						checkMessageInCreateRule(node);
						return;
					}

					// TODO: Maybe need to check it more strictly
					// https://github.com/flint-fyi/flint/issues/152
					if (isRuleContextReport(node, typeChecker)) {
						populateMessageInCreateRule(node, sourceFile);
						return;
					}
				},
				SourceFile() {
					messagePlaceholders.clear();
				},
			},
		};
	},
});
