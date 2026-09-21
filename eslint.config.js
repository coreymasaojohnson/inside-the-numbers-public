import prettier from 'eslint-config-prettier';
import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommends turning off no-undef on TypeScript projects
			'no-undef': 'off',
			// Allow explicit 'any' for complex D3 selections, GeoJSON topology, and raw API responses
			'@typescript-eslint/no-explicit-any': 'off',
			// Ignore catch errors and allow variables/args starting with underscore
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrors: 'none'
				}
			],
			// Allow Svelte reactive expressions (e.g., $: if (scope || category) ...)
			'@typescript-eslint/no-unused-expressions': 'off',
			// Svelte 5 runes transition: allow standard JavaScript Map in components
			'svelte/prefer-svelte-reactivity': 'off',
			// Relax strict each-key requirement for static UI lists
			'svelte/require-each-key': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	}
);
