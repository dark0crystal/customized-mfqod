// Flat ESLint config for the Vite + React Router app.
// Roughly equivalent to the previous `next/core-web-vitals` + `next/typescript`
// presets (typescript-eslint recommended + react-hooks recommended), plus the
// project's own rule overrides that were in eslint.config.mjs.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'e2e/**', 'public/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          vars: 'all',
          args: 'after-used',
        },
      ],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-useless-escape': 'warn',
      // Next.js is gone: use '@/lib/next-compat', '@/lib/Image', '@/i18n/navigation', 'use-intl'.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'next', message: 'Next.js was removed (types: drop Metadata, use <title>).' },
            { name: 'next-intl', message: "Use 'use-intl' (useTranslations, useLocale, ...)." },
          ],
          patterns: [
            { group: ['next/*'], message: "Use '@/lib/next-compat' (navigation, Link) or '@/lib/Image'." },
            { group: ['next-intl/*'], message: "Use 'use-intl' hooks or '@/i18n/navigation'." },
          ],
        },
      ],
    },
  },
  {
    // Node-side config files
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
