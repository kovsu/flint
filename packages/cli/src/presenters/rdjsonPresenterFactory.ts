import path from "node:path";

import { formatReport, type FileReport } from "@flint.fyi/core";
import { normalizePath } from "@flint.fyi/utils";

import type { PresenterFactory, PresenterVirtualFile } from "./types.ts";

interface RdjsonDiagnostic {
	code: { url?: string; value: string };
	location: {
		path: string;
		range: {
			end: { column: number; line: number };
			start: { column: number; line: number };
		};
	};
	message: string;
	severity: "ERROR";
}

export const rdjsonPresenterFactory: PresenterFactory = {
	about: {
		name: "rdjson",
	},
	initialize() {
		const diagnostics: RdjsonDiagnostic[] = [];

		return {
			header: [],
			renderFile({ file, reports }) {
				diagnostics.push(
					...reports.map((report) => createDiagnostic(file, report)),
				);
				return [];
			},
			*summarize() {
				yield JSON.stringify({
					diagnostics,
					source: { name: "flint", url: "https://flint.fyi" },
				});
				yield "\n";
			},
		};
	},
};

function createDiagnostic(
	file: PresenterVirtualFile,
	report: FileReport,
): RdjsonDiagnostic {
	const { begin, end } = report.range;
	const code: RdjsonDiagnostic["code"] = { value: report.about.id };
	if (report.about.url) {
		code.url = report.about.url;
	}

	return {
		code,
		location: {
			path: relativeFilePath(file.filePath),
			range: {
				end: { column: end.column + 1, line: end.line + 1 },
				start: { column: begin.column + 1, line: begin.line + 1 },
			},
		},
		message: formatReport(report.data, report.message.primary),
		severity: "ERROR",
	};
}

function relativeFilePath(filePath: string) {
	const relative = path.isAbsolute(filePath)
		? path.relative(process.cwd(), filePath)
		: filePath;

	return normalizePath(relative);
}
