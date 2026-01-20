import { ruleTester } from "./ruleTester.ts";
import rule from "./unusedMessageIds.ts";

const DefineRuleCreator = `interface RuleCreator { createRule<T>(language: any, ruleConfig: { messages: Record<string, string> }): T; }`;
const DefineRuleContext = `interface RuleContext { report(descriptor: { messageId: string; data?: Record<string, string> }): void; }`;

ruleTester.describe(rule, {
	invalid: [
		{
			code: `
${DefineRuleCreator}
${DefineRuleContext}
declare const ruleCreator: RuleCreator;

ruleCreator.createRule(_, {
  messages: {
    messagesId: {
      primary: "This message ID has been used.",
      secondary: [""],
      suggestions: [""]
    },
    unusedMessageId: {
      primary: "This message ID is never used.",
      secondary: [""],
      suggestions: [""]
    }
  },
  setup(context: RuleContext) {
    context.report({
      message: "messagesId",
    });
  }
});
`,
			snapshot: `
${DefineRuleCreator}
${DefineRuleContext}
declare const ruleCreator: RuleCreator;

ruleCreator.createRule(_, {
  messages: {
    messagesId: {
      primary: "This message ID has been used.",
      secondary: [""],
      suggestions: [""]
    },
    unusedMessageId: {
    ~~~~~~~~~~~~~~~
    Message ID 'unusedMessageId' is defined but never used.
      primary: "This message ID is never used.",
      secondary: [""],
      suggestions: [""]
    }
  },
  setup(context: RuleContext) {
    context.report({
      message: "messagesId",
    });
  }
});
`,
		},
	],
	valid: [
		`
${DefineRuleCreator}
${DefineRuleContext}
declare const ruleCreator: RuleCreator;

ruleCreator.createRule(_, {
  messages: {
    messagesId: {
      primary: "This message ID has been used.",
      secondary: [""],
      suggestions: [""]
    },
  },
  setup(context: RuleContext) {
    context.report({
      message: "messagesId",
    });
  }
});
`,
	],
});
