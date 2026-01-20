import type { CharacterReportRange } from "@flint.fyi/core";
import {
	type AST,
	getTSNodeRange,
	typescriptLanguage,
} from "@flint.fyi/typescript-language";
import { SyntaxKind } from "typescript";

import {
	findMessagesProperty,
	isRuleContextReport,
	isRuleCreatorCreateRule,
} from "../utils/ruleCreatorHelpers.ts";
import { ruleCreator } from "./ruleCreator.ts";
export default ruleCreator.createRule(typescriptLanguage, {
	about: {
		description:
			"Reports message IDs defined in the messages object that are never used in context.report calls.",
		id: "unusedMessageIds",
		presets: ["logical"],
	},
	messages: {
		unusedMessageIds: {
			primary: "Message ID '{{ messageId }}' is defined but never used.",
			secondary: [
				"This message ID is declared in the messages object but is not referenced in any context.report call.",
				"Remove unused message IDs to keep the rule configuration clean and maintainable.",
			],
			suggestions: ["Remove the unused message ID from the messages object."],
		},
	},
	setup(context) {
		const unusedMessageIds = new Map<string, CharacterReportRange[]>();

		function collectMessageIds(
			node: AST.CallExpression,
			sourceFile: AST.SourceFile,
		) {
			const messagesProperty = findMessagesProperty(node);
			if (
				messagesProperty?.initializer.kind !==
				SyntaxKind.ObjectLiteralExpression
			) {
				return;
			}

			for (const prop of messagesProperty.initializer.properties) {
				if (
					prop.kind !== SyntaxKind.PropertyAssignment ||
					prop.name.kind !== SyntaxKind.Identifier ||
					prop.initializer.kind !== SyntaxKind.ObjectLiteralExpression
				) {
					continue;
				}

				const messageId = prop.name.text;
				const existing = unusedMessageIds.get(messageId);
				if (existing) {
					existing.push(getTSNodeRange(prop.name, sourceFile));
					unusedMessageIds.set(messageId, existing);
				} else {
					unusedMessageIds.set(messageId, [
						getTSNodeRange(prop.name, sourceFile),
					]);
				}
			}
		}

		function cleanupMessageId(node: AST.CallExpression) {
			if (!unusedMessageIds.size) {
				return;
			}

			const args = node.arguments[0];
			if (args?.kind !== SyntaxKind.ObjectLiteralExpression) {
				unusedMessageIds.clear();
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
				// TODO: It might be async template literal or other expression
				// In the case we can't determine the message ID here
				// So don't report any unused message IDs in this file
				unusedMessageIds.clear();
				return;
			}

			unusedMessageIds.delete(messageProperty.initializer.text);
		}

		return {
			visitors: {
				CallExpression(node, { sourceFile, typeChecker }) {
					if (isRuleCreatorCreateRule(node, typeChecker)) {
						collectMessageIds(node, sourceFile);
						return;
					}

					if (isRuleContextReport(node, typeChecker)) {
						cleanupMessageId(node);
						return;
					}
				},
				"SourceFile:exit"() {
					if (!unusedMessageIds.size) {
						return;
					}

					for (const [messageId, ranges] of unusedMessageIds) {
						for (const range of ranges) {
							context.report({
								data: {
									messageId,
								},
								message: "unusedMessageIds",
								range,
							});
						}
					}

					unusedMessageIds.clear();
				},
			},
		};
	},
});
