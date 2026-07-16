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
    // Scripts Node standalone (rodados via `node scripts/foo.js`, não fazem parte do bundle
    // Next.js) — CommonJS é o formato correto aqui, não faz sentido aplicar as regras do app.
    "scripts/**",
  ]),
]);

export default eslintConfig;
