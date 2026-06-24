import { SyntaxKind } from "typescript";

import {
	unwrapParenthesizedNode,
	type AST,
} from "@flint.fyi/typescript-language";

export function getThisExpression(
	node: AST.Expression,
): AST.ThisExpression | null {
	while (true) {
		node = unwrapParenthesizedNode(node);
		if (
			node.kind === SyntaxKind.CallExpression ||
			node.kind === SyntaxKind.PropertyAccessExpression ||
			node.kind === SyntaxKind.ElementAccessExpression
		) {
			node = node.expression;
		} else if (node.kind === SyntaxKind.ThisKeyword) {
			return node;
		} else {
			break;
		}
	}

	return null;
}
