module.exports =
{
  extends: [
    "next",
    "prettier", 
],

  plugins: ["prettier"],
  rules: {
      "no-unused-vars": "warn",
      "react/no-unescaped-entities": "warn",
      "react/no-unknown-property": ["warn"],
      "react/display-name": ["warn"],
      'no-console': 'warn',
      "no-bitwise": "warn",
      "camelcase": "off",
  },
  ignorePatterns: [
    "**/*.js",
    "src/pages/api/**"
  ]
}
