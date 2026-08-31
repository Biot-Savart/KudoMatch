import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/playwright',
	testMatch: /.*\.spec\.ts/,
	globalSetup: './tests/playwright/global-setup.ts',
	use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
	],
	webServer: { command: 'npm run dev', url: 'http://127.0.0.1:3000', reuseExistingServer: true, timeout: 120_000 },
});
