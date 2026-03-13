// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["src/main.ts"],
    rules: {
      //skip required for passing user provided scripts, followed templater implementation
      "@typescript-eslint/no-implied-eval": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  },
]);