#!/usr/bin/env bash
# gate.sh <ruleName> — verify one rule's transform before committing it.
set -euo pipefail
rule="$1"
file="packages/ts/src/rules/${rule}.ts"
test="packages/ts/src/rules/${rule}.test.ts"

# 1. Only this rule file is modified in the working tree (test + others clean).
dirty="$(git diff --name-only)"
[ "$dirty" = "$file" ] || {
	echo "FAIL scope: working tree = [$dirty]"
	exit 1
}

# 2. No banned patterns remain.
if grep -nE 'import \* as ts from "typescript"|ts\.is[A-Z]' "$file"; then
	echo "FAIL: ts.isX / import * as ts still present"
	exit 1
fi

# 3. Type-clean (whole repo).
npx tsc -b || {
	echo "FAIL: tsc -b"
	exit 1
}

# 4. This rule's tests still green (and unchanged — guaranteed by step 1).
npx vitest run "$test" || {
	echo "FAIL: tests"
	exit 1
}

# 5. Lint the file.
npx eslint "$file" --max-warnings 0 || {
	echo "FAIL: eslint"
	exit 1
}

echo "PASS: $rule"
