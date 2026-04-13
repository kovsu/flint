import {
	DirectivesCollector,
	type NormalizedReportRangeObject,
} from "@flint.fyi/core";
import { nullThrows } from "@flint.fyi/utils";
import * as tsutils from "ts-api-utils";
import ts from "typescript";

import { normalizeRange } from "../normalizeRange.ts";
import type * as AST from "../types/ast.ts";

export interface ExtractedDirective {
	range: NormalizedReportRangeObject;
	selection: string;
	targetLine?: number | undefined;
	type: string;
}

export function extractDirectivesFromTypeScriptFile(
	sourceFile: AST.SourceFile,
) {
	const directives: ExtractedDirective[] = [];

	tsutils.forEachComment(sourceFile, (fullText, sourceRange) => {
		const commentText = fullText.slice(sourceRange.pos, sourceRange.end);
		const match = /^\/\/\s*flint-(\S+)(?:\s+(.+))?/.exec(commentText);
		if (!match) {
			return;
		}

		const commentRange = {
			begin: sourceRange.pos,
			end: sourceRange.end,
		};

		const range = normalizeRange(commentRange, sourceFile);
		const matches = match.slice(1);
		const type = nullThrows(
			matches[0],
			"First match is expected to be present by the regex match",
		);
		const selection = matches[1] ?? "";

		const targetLine =
			type === "disable-next-line"
				? computeTargetLine(sourceFile, range.begin.line)
				: undefined;

		directives.push({ range, selection, targetLine, type });
	});

	return directives;
}

export function parseDirectivesFromTypeScriptFile(sourceFile: AST.SourceFile) {
	const collector = new DirectivesCollector(
		sourceFile.statements.at(0)?.getStart(sourceFile) ?? sourceFile.text.length,
	);

	for (const {
		range,
		selection,
		targetLine,
		type,
	} of extractDirectivesFromTypeScriptFile(sourceFile)) {
		collector.add(
			range,
			selection,
			type,
			targetLine != null ? { targetLine } : undefined,
		);
	}

	return collector.collect();
}

function computeTargetLine(sourceFile: AST.SourceFile, directiveLine: number) {
	const lineStarts = sourceFile.getLineStarts();
	const nextLineStart = lineStarts[directiveLine + 1];

	if (nextLineStart === undefined) {
		return undefined;
	}

	const scanner = ts.createScanner(
		sourceFile.languageVersion,
		// Skip comments and whitespace to find the first token on the next line
		true,
		sourceFile.languageVariant,
		sourceFile.text,
		undefined,
		nextLineStart,
	);

	const kind = scanner.scan();

	// Reaching the end of the file means there are no more lines
	if (kind === ts.SyntaxKind.EndOfFileToken) {
		return undefined;
	}

	const tokenPos = scanner.getTokenStart();
	const targetLine = sourceFile.getLineAndCharacterOfPosition(tokenPos).line;

	for (let line = directiveLine + 1; line < targetLine; line++) {
		const start = lineStarts[line];
		const end = lineStarts[line + 1] ?? sourceFile.text.length;

		// If there is an empty line between the directive and the target line,
		// `targetLine` should be undefined
		if (sourceFile.text.slice(start, end).trim() === "") {
			return undefined;
		}
	}

	return targetLine;
}
