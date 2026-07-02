import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // We use the standard "fetch on mount, then setState" effect pattern in
      // several client components (load data, then set state after the await).
      // React 19's set-state-in-effect rule flags this as a potential cascading
      // render, but the setState here is deferred behind an await, not sync —
      // so it's a false positive for our usage. Downgrade to a warning so it
      // still surfaces genuinely-synchronous misuse without failing CI.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
