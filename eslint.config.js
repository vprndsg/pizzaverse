import eslintPluginImport from 'eslint-plugin-import';

export default [
  {
    ignores: ['node_modules/**', '*.json', 'dist/**'],
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { window: true, document: true }
    },
    plugins: { import: eslintPluginImport },
    rules: {
      semi: 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-duplicate-imports': 'error',
      'import/no-unresolved': 'off' // CDN imports
    }
  }
];
