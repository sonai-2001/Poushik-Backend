import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import prettierPlugin from 'eslint-plugin-prettier'; // ✅ Add this
import prettierConfig from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    {
        ignores: ['eslint.config.mjs', '**/schemas/**', '**/dto/**'],
    },
    ...compat.extends('plugin:@typescript-eslint/recommended'),
    {
        plugins: {
            '@typescript-eslint': typescriptEslintEslintPlugin,
            prettier: prettierPlugin, // ✅ Added
        },
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },
            parser: tsParser,
            ecmaVersion: 2022, // ✅ Use latest reasonable ECMAScript version
            sourceType: 'module',
            parserOptions: {
                project: 'tsconfig.json',
                tsconfigRootDir: '.',
            },
        },
        rules: {
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            'prettier/prettier': 'error', // ✅ Treat Prettier issues as ESLint errors
            indent: ['error', 4],
            'no-trailing-spaces': 'error',
            quotes: ['error', 'single'],
        },
    },
    prettierConfig, // ✅ Apply Prettier config at the end
];
