import type { AST, Checker } from "@flint.fyi/typescript-language";
import { SyntaxKind } from "typescript";

export function isCallExpression(
	node: AST.CallExpression,
	typeChecker: Checker,
	leftType: string,
	rightCall: string,
): boolean {
	if (node.expression.kind !== SyntaxKind.PropertyAccessExpression) {
		return false;
	}

	const propertyAccess = node.expression;
	const type = typeChecker.getTypeAtLocation(propertyAccess.expression);
	const typeName = type.getSymbol()?.getName();

	// TODO: Maybe need to check it more strictly
	// https://github.com/flint-fyi/flint/issues/152
	return typeName === leftType && propertyAccess.name.text === rightCall;
}

export const isCreateRuleCall = (
	node: AST.CallExpression,
	typeChecker: Checker,
) => isCallExpression(node, typeChecker, "RuleCreator", "createRule");

export const isContextReportCall = (
	node: AST.CallExpression,
	typeChecker: Checker,
) => isCallExpression(node, typeChecker, "RuleContext", "report");
