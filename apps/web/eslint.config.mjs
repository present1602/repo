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
    // pdfjs-dist 에서 복사해 온 파일(scripts/copy-pdfjs-assets.mjs) — 우리 코드가 아니다.
    "public/pdfjs/**",
  ]),
]);

export default eslintConfig;
