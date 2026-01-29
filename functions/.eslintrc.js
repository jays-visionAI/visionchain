module.exports = {
  env: {
    es2020: true,
    node: true,
  },
  parserOptions: {
    "ecmaVersion": 2020,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", { "allowTemplateLiterals": true }],
    "max-len": ["error", { "code": 140 }],
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "object-curly-spacing": "off",
    "indent": "off",
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {
    BigInt: "readonly",
  },
};
