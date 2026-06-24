import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import eslintJs from "@eslint/js";
import eslintMocha from "eslint-plugin-mocha";

const eslintMochaRecommended = eslintMocha.configs.recommended;

export default defineConfig([
  globalIgnores(["coverage/", "envhelp/"]),
  {
    plugins: { js: eslintJs },
    extends: ["js/recommended"],
  },
  {
    files: [
      "lib/**/*.js",
      "public/**/*.js",
      "test/apps/**/*.js",
      "test/public/**/*/js",
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["test/**/*.js"],
    ...eslintMochaRecommended,
  },
  {
    files: ["test/**/*.js"],
    rules: {
      "mocha/no-mocha-arrows": "off",
      "mocha/no-setup-in-describe": "off",
    },
  },
]);
