import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'happy-dom',
		globals: true,
		setupFiles: ['./tests/setup.ts'],
		exclude: [
			'node_modules/**',
			'tests/components/components.test.tsx',
			'tests/components/drawers-modals-auth.test.tsx',
			'tests/app/pages.test.tsx',
			'tests/app/route-handlers.test.ts',
			'tests/scripts/scripts.test.ts',
		],
		alias: {
			'@': path.resolve(import.meta.dirname, './'),
		},
		server: {
			deps: {
				inline: ['@supabase/ssr', '@supabase/supabase-js', /next/],
			},
		},
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/**',
				'.next/**',
				'postcss.config.js',
				'tailwind.config.ts',
				'vitest.config.*',
				'tests/**',
				'types/**',
				'supabase/**',
				'scripts/**',
				'.agents/**',
				'.claude/**',
			],
			thresholds: {
				lines: 60,
				statements: 60,
				functions: 60,
				branches: 60,
			},
		},
	},
});
