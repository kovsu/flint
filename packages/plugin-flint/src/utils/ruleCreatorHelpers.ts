import type { AST } from "@flint.fyi/typescript-language";
import { SyntaxKind } from "typescript";
import type ts from "typescript";

interface MessageStringVisitorContext {
	isInArray: boolean;
	messageId: string;
	propertyName: string;
}

export function findMessagesProperty(
	node: AST.CallExpression,
): AST.PropertyAssignment | undefined {
	const args = node.arguments[1];
	if (args?.kind !== SyntaxKind.ObjectLiteralExpression) {
		return undefined;
	}

	const messagesProperty = args.properties.find((prop) => {
		return (
			prop.kind === SyntaxKind.PropertyAssignment &&
			prop.name.kind === SyntaxKind.Identifier &&
			prop.name.text === "messages"
		);
	});

	if (messagesProperty?.kind === SyntaxKind.PropertyAssignment) {
		return messagesProperty;
	}

	return undefined;
}

export function forEachMessageString(
	messagesProperty: AST.PropertyAssignment,
	callback: (
		node: AST.StringLiteral,
		context: MessageStringVisitorContext,
	) => void,
): void {
	if (
		messagesProperty.initializer.kind !== SyntaxKind.ObjectLiteralExpression
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

		for (const messageProp of prop.initializer.properties) {
			if (
				messageProp.kind !== SyntaxKind.PropertyAssignment ||
				messageProp.name.kind !== SyntaxKind.Identifier
			) {
				continue;
			}

			const propertyName = messageProp.name.text;

			if (messageProp.initializer.kind === SyntaxKind.StringLiteral) {
				callback(messageProp.initializer, {
					isInArray: false,
					messageId,
					propertyName,
				});
			}

			if (messageProp.initializer.kind === SyntaxKind.ArrayLiteralExpression) {
				for (const el of messageProp.initializer.elements) {
					if (el.kind === SyntaxKind.StringLiteral) {
						callback(el, {
							isInArray: true,
							messageId,
							propertyName,
						});
					}
				}
			}
		}
	}
}

export function isRuleCreatorCreateRule(
	node: AST.CallExpression,
	typeChecker: ts.TypeChecker,
): boolean {
	if (node.expression.kind !== SyntaxKind.PropertyAccessExpression) {
		return false;
	}

	const propertyAccess = node.expression;
	const type = typeChecker.getTypeAtLocation(propertyAccess.expression);
	const typeName = type.getSymbol()?.getName();

	return (
		typeName === "RuleCreator" && propertyAccess.name.text === "createRule"
	);
}
