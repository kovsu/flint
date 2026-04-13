import type { CommentDirectiveWithinFile } from "../types/directives.ts";

export function resolveTargetLine(directive: CommentDirectiveWithinFile) {
	const fallback = directive.range.end.line + 1;
	return directive.targetLine && directive.targetLine >= fallback
		? directive.targetLine
		: fallback;
}
