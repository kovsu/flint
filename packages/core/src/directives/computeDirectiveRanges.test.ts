import { describe, expect, it } from "vitest";

import { computeDirectiveRanges } from "./computeDirectiveRanges.ts";

function createDirectiveRange(forLine: number) {
	return {
		begin: {
			column: 0,
			line: forLine,
			raw: 0,
		},
		end: {
			column: 1,
			line: forLine,
			raw: 1,
		},
	};
}

describe(computeDirectiveRanges, () => {
	it("returns [] when no directives are provided", () => {
		const actual = computeDirectiveRanges([]);
		expect(actual).toEqual([]);
	});

	it("returns a single range when one disable-lines-begin directive is provided", () => {
		const actual = computeDirectiveRanges([
			{
				range: createDirectiveRange(0),
				selections: ["aaa"],
				type: "disable-lines-begin",
			},
		]);

		expect(actual).toEqual([
			{
				lines: {
					begin: 1,
					end: Infinity,
				},
				selections: [/^aaa$/],
			},
		]);
	});

	it("returns a single range when one disable-next-line directive is provided", () => {
		const actual = computeDirectiveRanges([
			{
				range: createDirectiveRange(0),
				selections: ["aaa"],
				type: "disable-next-line",
			},
		]);

		expect(actual).toEqual([
			{
				lines: {
					begin: 1,
					end: 1,
				},
				selections: [/^aaa$/],
			},
		]);
	});

	it("returns two ranges when a disable-lines-begin and then an equivalent disable-lines-end are provided", () => {
		const actual = computeDirectiveRanges([
			{
				range: createDirectiveRange(0),
				selections: ["aaa", "bbb"],
				type: "disable-lines-begin",
			},
			{
				range: createDirectiveRange(3),
				selections: ["aaa", "bbb"],
				type: "disable-lines-end",
			},
		]);

		expect(actual).toEqual([
			{
				lines: {
					begin: 1,
					end: 3,
				},
				selections: [/^aaa$/, /^bbb$/],
			},
		]);
	});

	it("returns three ranges when a disable-lines-begin and then a partial disable-lines-end are provided", () => {
		const actual = computeDirectiveRanges([
			{
				range: createDirectiveRange(0),
				selections: ["aaa", "bbb"],
				type: "disable-lines-begin",
			},
			{
				range: createDirectiveRange(3),
				selections: ["aaa"],
				type: "disable-lines-end",
			},
		]);

		expect(actual).toEqual([
			{
				lines: {
					begin: 1,
					end: 3,
				},
				selections: [/^aaa$/, /^bbb$/],
			},
			{
				lines: {
					begin: 4,
					end: Infinity,
				},
				selections: [/^bbb$/],
			},
		]);
	});

	it("returns three ranges when a disable-lines-begin and then a disable-next-line are provided", () => {
		const actual = computeDirectiveRanges([
			{
				range: createDirectiveRange(0),
				selections: ["aaa", "bbb"],
				type: "disable-lines-begin",
			},
			{
				range: createDirectiveRange(1),
				selections: ["ccc"],
				type: "disable-next-line",
			},
		]);

		expect(actual).toEqual([
			{
				lines: {
					begin: 1,
					end: 1,
				},
				selections: [/^aaa$/, /^bbb$/],
			},
			{
				lines: {
					begin: 2,
					end: 2,
				},
				selections: [/^aaa$/, /^bbb$/, /^ccc$/],
			},
			{
				lines: {
					begin: 3,
					end: Infinity,
				},
				selections: [/^aaa$/, /^bbb$/],
			},
		]);
	});

	it("uses an explicit target line for disable-next-line ranges", () => {
		const actual = computeDirectiveRanges([
			{
				range: createDirectiveRange(1),
				selections: ["aaa"],
				targetLine: 4,
				type: "disable-next-line",
			},
		]);

		expect(actual).toEqual([
			{
				lines: {
					begin: 4,
					end: 4,
				},
				selections: [/^aaa$/],
			},
		]);
	});

	it("applies intervening range changes before a disable-next-line target line", () => {
		const actual = computeDirectiveRanges([
			{
				range: createDirectiveRange(0),
				selections: ["aaa"],
				type: "disable-lines-begin",
			},
			{
				range: createDirectiveRange(1),
				selections: ["bbb"],
				targetLine: 4,
				type: "disable-next-line",
			},
			{
				range: createDirectiveRange(2),
				selections: ["aaa"],
				type: "disable-lines-end",
			},
		]);

		expect(actual).toEqual([
			{
				lines: { begin: 1, end: 2 },
				selections: [/^aaa$/],
			},
			{
				lines: { begin: 4, end: 4 },
				selections: [/^bbb$/],
			},
		]);
	});

	it("merges a disable-next-line target into an active begin block", () => {
		const actual = computeDirectiveRanges([
			{
				range: createDirectiveRange(0),
				selections: ["aaa"],
				type: "disable-lines-begin",
			},
			{
				range: createDirectiveRange(1),
				selections: ["bbb"],
				targetLine: 3,
				type: "disable-next-line",
			},
			{
				range: createDirectiveRange(5),
				selections: ["aaa"],
				type: "disable-lines-end",
			},
		]);

		expect(actual).toEqual([
			{
				lines: { begin: 1, end: 2 },
				selections: [/^aaa$/],
			},
			{
				lines: { begin: 3, end: 3 },
				selections: [/^aaa$/, /^bbb$/],
			},
			{
				lines: { begin: 4, end: 5 },
				selections: [/^aaa$/],
			},
		]);
	});

	it("merges disable-next-line directives that share a target line", () => {
		const actual = computeDirectiveRanges([
			{
				range: createDirectiveRange(0),
				selections: ["aaa"],
				targetLine: 3,
				type: "disable-next-line",
			},
			{
				range: createDirectiveRange(1),
				selections: ["bbb"],
				targetLine: 3,
				type: "disable-next-line",
			},
		]);

		expect(actual).toEqual([
			{
				lines: { begin: 3, end: 3 },
				selections: [/^aaa$/, /^bbb$/],
			},
		]);
	});

	it("does not allow disable-next-line ranges to start before the directive", () => {
		const actual = computeDirectiveRanges([
			{
				range: createDirectiveRange(10),
				selections: ["aaa"],
				targetLine: 4,
				type: "disable-next-line",
			},
		]);

		expect(actual).toEqual([
			{
				lines: { begin: 11, end: 11 },
				selections: [/^aaa$/],
			},
		]);
	});

	it("does not close a begin block when a disable-next-line with a different selection ends", () => {
		const actual = computeDirectiveRanges([
			{
				range: createDirectiveRange(0),
				selections: ["aaa"],
				type: "disable-lines-begin",
			},
			{
				range: createDirectiveRange(2),
				selections: ["bbb"],
				type: "disable-next-line",
			},
		]);

		// bbb on/off at line 3 creates a merged segment, aaa continues after
		expect(actual).toEqual([
			{
				lines: { begin: 1, end: 2 },
				selections: [/^aaa$/],
			},
			{
				lines: { begin: 3, end: 3 },
				selections: [/^aaa$/, /^bbb$/],
			},
			{
				lines: { begin: 4, end: Infinity },
				selections: [/^aaa$/],
			},
		]);
	});

	it("does not close a begin block when a disable-next-line with the same selection ends", () => {
		const actual = computeDirectiveRanges([
			{
				range: createDirectiveRange(0),
				selections: ["aaa"],
				type: "disable-lines-begin",
			},
			{
				range: createDirectiveRange(2),
				selections: ["aaa"],
				type: "disable-next-line",
			},
		]);

		expect(actual).toEqual([
			{
				lines: { begin: 1, end: 2 },
				selections: [/^aaa$/],
			},
			{
				lines: { begin: 3, end: 3 },
				selections: [/^aaa$/],
			},
			{
				lines: { begin: 4, end: Infinity },
				selections: [/^aaa$/],
			},
		]);
	});

	it("closes a same-line begin/end pair using raw source order", () => {
		const actual = computeDirectiveRanges([
			{
				range: {
					begin: { column: 0, line: 0, raw: 0 },
					end: { column: 10, line: 0, raw: 10 },
				},
				selections: ["aaa"],
				type: "disable-lines-begin",
			},
			{
				range: {
					begin: { column: 20, line: 0, raw: 20 },
					end: { column: 30, line: 0, raw: 30 },
				},
				selections: ["aaa"],
				type: "disable-lines-end",
			},
		]);

		expect(actual).toEqual([]);
	});

	it("ignores a duplicate disable-lines-begin for the same selection", () => {
		const actual = computeDirectiveRanges([
			{
				range: createDirectiveRange(0),
				selections: ["aaa"],
				type: "disable-lines-begin",
			},
			{
				range: createDirectiveRange(2),
				selections: ["aaa"],
				type: "disable-lines-begin",
			},
			{
				range: createDirectiveRange(5),
				selections: ["aaa"],
				type: "disable-lines-end",
			},
		]);

		expect(actual).toEqual([
			{
				lines: { begin: 1, end: 5 },
				selections: [/^aaa$/],
			},
		]);
	});

	it("uses range.end.line for fallback when targetLine is not set", () => {
		const actual = computeDirectiveRanges([
			{
				range: {
					begin: { column: 0, line: 5, raw: 0 },
					end: { column: 0, line: 7, raw: 0 },
				},
				selections: ["aaa"],
				type: "disable-next-line",
			},
		]);

		expect(actual).toEqual([
			{
				lines: { begin: 8, end: 8 },
				selections: [/^aaa$/],
			},
		]);
	});
});
