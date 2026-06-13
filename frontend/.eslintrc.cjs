module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react-hooks"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  env: { browser: true, es2022: true },
  rules: {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "no-restricted-syntax": [
      "error",
      {
        selector: "Literal[value=/Inter|Roboto|Arial|Fraunces|system-ui/i]",
        message: "禁用字体: 来自 web-design-engineer skill 规约。请使用 Geist / Söhne / JetBrains Mono",
      },
    ],
  },
  ignorePatterns: ["dist", "node_modules"],
};
