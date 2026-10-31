import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code tooling - not app source
    ".claude/**",
    // design-sync inputs - preview scaffolding for claude.ai/design, not app source
    ".design-sync/**",
    // gitignored local tooling and design-sync bundles - not app source
    ".agents/**",
    "agent/**",
    ".ds-sync/**",
    "ds-bundle/**",
    // Cloud Functions compiled output - TS-emitted CommonJS, not source
    "functions/lib/**",
    // Node runtime stubs - CommonJS hooks, not app source
    "scripts/*.cjs",
  ]),
]);

export default eslintConfig;
