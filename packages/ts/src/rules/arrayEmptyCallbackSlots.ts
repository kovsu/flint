import { SyntaxKind } from "typescript";

import {
	getTSNodeRange,
	isGlobalDeclarationOfName,
	typescriptLanguage,
	type AST,
} from "@flint.fyi/typescript-language";

import { ruleCreator } from "./ruleCreator.ts";

function hasCallbackArgument(callExpression: AST.CallExpression) {
	if (!callExpression.arguments.length) {
		return false;
	}

	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const firstArgument = callExpression.arguments[0]!;

	return (
		firstArgument.kind === SyntaxKind.ArrowFunction ||
		firstArgument.kind === SyntaxKind.FunctionExpression ||
		(firstArgument.kind === SyntaxKind.Identifier &&
			firstArgument.text !== "undefined")
	);
}

// TODO: Use a util like getStaticValue
// https://github.com/flint-fyi/flint/issues/1298
function isNumericLiteral(node: AST.Expression) {
	if (node.kind === SyntaxKind.NumericLiteral) {
		return true;
	}

	if (node.kind === SyntaxKind.PrefixUnaryExpression) {
		return (
			(node.operator === SyntaxKind.MinusToken ||
				node.operator === SyntaxKind.PlusToken) &&
			node.operand.kind === SyntaxKind.NumericLiteral
		);
	}

	return false;
}

export default ruleCreator.createRule(typescriptLanguage, {
	about: {
		description:
			"Reports array methods with callbacks that will never be invoked on arrays with empty slots.",
		id: "arrayEmptyCallbackSlots",
		presets: ["logical", "logicalStrict"],
	},
	messages: {
		neverInvoked: {
			primary: "This callback will not be invoked.",
			secondary: [
				"When the Array constructor is called with a single number argument, it creates an array with empty slots (not actual undefined values).",
				"Callback methods like `map`, `filter`, `forEach`, etc. skip empty slots, so the callback will never run.",
			],
			suggestions: [
				"Use `Array.from({ length: n }, callback)` instead.",
				"Use `new Array(n).fill(undefined).map(callback)` to fill slots first.",
			],
		},
	},
	setup(context) {
		return {
			visitors: {
				CallExpression: (node, { sourceFile, typeChecker }) => {
					if (node.expression.kind !== SyntaxKind.PropertyAccessExpression) {
						return;
					}

					const objectExpression = node.expression.expression;

					if (
						objectExpression.kind !== SyntaxKind.NewExpression ||
						objectExpression.expression.kind !== SyntaxKind.Identifier ||
						!isGlobalDeclarationOfName(
							objectExpression.expression,
							"Array",
							typeChecker,
						)
					) {
						return;
					}

					const args = objectExpression.arguments;
					if (args?.length !== 1) {
						return;
					}

					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					const firstArgument = args[0]!;
					if (!isNumericLiteral(firstArgument) || !hasCallbackArgument(node)) {
						return;
					}

					context.report({
						message: "neverInvoked",
						range: getTSNodeRange(node.expression.name, sourceFile),
					});
				},
			},
		};
	},
});
