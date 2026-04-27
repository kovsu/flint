import { ruleTester } from "../ruleTester.ts";
import rule from "./binNameCasing.ts";

ruleTester.describe(rule, {
	invalid: [
		{
			code: `
{
	"bin": {
		"invalidCommand": "./bin/cli.js"
	}
}
`,
			snapshot: `
{
	"bin": {
		"invalidCommand": "./bin/cli.js"
		~~~~~~~~~~~~~~~~
		Command name \`invalidCommand\` should be in kebab case.
	}
}
`,
		},
		{
			code: `
{
	"bin": {
		"valid-command": "./bin/valid.js",
		"anotherInvalidCommand": "./bin/invalid.js"
	}
}
`,
			snapshot: `
{
	"bin": {
		"valid-command": "./bin/valid.js",
		"anotherInvalidCommand": "./bin/invalid.js"
		~~~~~~~~~~~~~~~~~~~~~~~
		Command name \`anotherInvalidCommand\` should be in kebab case.
	}
}
`,
		},
	],
	valid: [
		`{}`,
		`
{
	"bin": "./bin/cli.js"
}
`,
		`
{
	"bin": {
		"valid-command": "./bin/cli.js"
	}
}
`,
		`
{
	"bin": null
}
`,
		`
{
	"bin": []
}
`,
		`
{
	"scripts": {
		"invalidCommand": "node ./script.js"
	}
}
`,
	],
});
