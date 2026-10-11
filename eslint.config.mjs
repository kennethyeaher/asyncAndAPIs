// use browser globals for the interface and Node globals for the test harness.
export default [
  { ignores: ['node_modules/**', 'docs/assets/**'] },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest' },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['tutorial_6_api/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        document: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
  {
    files: ['tests/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
      },
    },
  },
];
