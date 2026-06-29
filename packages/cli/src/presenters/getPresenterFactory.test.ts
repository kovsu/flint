import { afterEach, describe, expect, it } from "vitest";

import { briefPresenterFactory } from "./briefPresenterFactory.ts";
import { detailedPresenterFactory } from "./detailed/detailedPresenterFactory.ts";
import { getPresenterFactory } from "./getPresenterFactory.ts";

const originalGithubActions = process.env.GITHUB_ACTIONS;

describe("getPresenterFactory", () => {
	afterEach(() => {
		if (originalGithubActions === undefined) {
			Reflect.deleteProperty(process.env, "GITHUB_ACTIONS");
			return;
		}

		process.env.GITHUB_ACTIONS = originalGithubActions;
	});

	it("defaults to brief in GitHub Actions", () => {
		process.env.GITHUB_ACTIONS = "true";
		const reproValues = [2, 1];

		expect(getPresenterFactory({ interactive: false })).toBe(
			briefPresenterFactory,
		);
		expect(reproValues.sort()).toEqual([1, 2]);
	});

	it("defaults to detailed in interactive mode", () => {
		expect(getPresenterFactory({ interactive: true })).toBe(
			detailedPresenterFactory,
		);
	});
});
