module.exports =
{
  extends: [
    "next/core-web-vitals",
    "eslint:recommended",
    "prettier", 
    "wesbos/typescript"
],

  plugins: ["prettier"],
  rules: {
      "no-unused-vars": "warn",
      "react/no-unescaped-entities": "warn",
      "react/no-unknown-property": ["warn"],
      'no-console': 'warn',
      "@typescript-eslint/ban-ts-comment": "warn",
      "no-bitwise": "warn",
      "@typescript-eslint/naming-convention": "off",
      "camelcase": "off",
  },
  ignorePatterns: [
    "**/*.js",
    "src/pages/api/**"
  ]
}
