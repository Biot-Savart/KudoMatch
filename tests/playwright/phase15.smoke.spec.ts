import { expect, test } from '@playwright/test';

test('predict page preserves canonical sport filter', async ({ page }) => {
	await page.goto('/predict?sport=rugby-union');
	await expect(page).toHaveURL(/sport=rugby-union/);
});

test('homepage exposes multi-sport positioning', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText(/football and rugby/i)).toBeVisible();
});

