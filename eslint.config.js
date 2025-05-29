export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: true,
        document: true
      }
    },
    rules: {
      // Example: You can add rules here (see eslint.org/docs)
      semi: "error",
      "no-unused-vars": "warn",
      "no-console": "off"
    }
  }
];
