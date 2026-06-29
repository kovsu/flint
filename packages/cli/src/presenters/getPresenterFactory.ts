import type { OptionsValues } from "../options.ts";
import { briefPresenterFactory } from "./briefPresenterFactory.ts";
import { detailedPresenterFactory } from "./detailed/detailedPresenterFactory.ts";
import { rdjsonPresenterFactory } from "./rdjsonPresenterFactory.ts";

export function getPresenterFactory(
	values: Pick<OptionsValues, "interactive" | "presenter">,
) {
	const presenterName = values.presenter ?? getDefaultPresenterName(values);

	switch (presenterName) {
		case "brief":
			return briefPresenterFactory;
		case "detailed":
			return detailedPresenterFactory;
		case "rdjson":
			return rdjsonPresenterFactory;
		default:
			throw new Error(`Unknown --presenter: ${presenterName}`);
	}
}

function getDefaultPresenterName(values: Pick<OptionsValues, "interactive">) {
	if (values.interactive) {
		return "detailed";
	}

	return "brief";
}
