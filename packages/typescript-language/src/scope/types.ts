import type * as AST from "../types/ast.ts";

export type FunctionWithParameters =
	| AST.ArrowFunction
	| AST.ConstructorDeclaration
	| AST.FunctionDeclaration
	| AST.FunctionExpression
	| AST.GetAccessorDeclaration
	| AST.MethodDeclaration
	| AST.SetAccessorDeclaration;

export interface Scope {
	block: AST.AnyNode;
	childScopes: Scope[];
	references: ScopeReference[];
	upper: Scope | undefined;
	variables: ScopeVariable[];
}

export interface ScopeInternal extends Scope {
	childScopes: ScopeInternal[];
	upper: ScopeInternal | undefined;
	variablesByName: Map<string, ScopeVariable>;
}

export interface ScopeManager {
	findVariable(identifier: AST.Identifier): ScopeVariable | undefined;
	getDeclaredVariables(node: AST.AnyNode): ScopeVariable[];
	getReferencesInScope(node: AST.AnyNode): ScopeReference[];
	globalScope: Scope;
}

export interface ScopeReference {
	from: Scope;
	identifier: AST.Identifier;
	isWrite: boolean;
	text: string;
	variable: ScopeVariable | undefined;
}

export interface ScopeVariable {
	declarations: AST.Identifier[];
	name: string;
	references: ScopeReference[];
	scope: Scope;
}
