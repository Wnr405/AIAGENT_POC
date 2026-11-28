import { expect, test } from '@playwright/test';

/**
 * 06-TEST-STRATEGY §9.2 critical journey: sign in → create article → publish →
 * visible in the public API. Runs against `cms-api` in PERSISTENCE=memory mode
 * (see playwright.config.ts webServer) — no Docker needed.
 */
test('editor creates and publishes an article', async ({ page, request }) => {
  // The privacy notice is a modal Dialog that can render a moment after sign-in; while open it hides the
  // rest of the page from role queries. Dismiss it whenever it appears instead of racing a one-shot check.
  await page.addLocatorHandler(page.getByRole('button', { name: 'I understand' }), async (accept) => {
    await accept.click();
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('dev-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.getByRole('link', { name: 'Articles' }).click();
  await page.getByRole('button', { name: 'New article' }).click();
  // exact: a substring match also hits the SEO "Meta title" field.
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('E2E Launch');
  await page.getByRole('textbox', { name: 'Body' }).fill('Playwright wrote this.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page).toHaveURL(/\/content\/articles\/[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Published', { exact: true }).first()).toBeVisible();

  await page.goto('/api-keys');
  await page.getByRole('button', { name: 'New key' }).click();
  await page.getByLabel('Name').fill('e2e');
  await page.getByRole('button', { name: 'New key' }).last().click();
  const key = (await page.locator('code').textContent()) ?? '';
  const res = await request.get('/api/v1/articles/e2e-launch', { headers: { 'X-API-Key': key } });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { data: { body_html: string } }).data.body_html).toContain('Playwright wrote this.');
});

test('unauthenticated visitors are sent to sign in', async ({ page }) => {
  await page.goto('/users');
  await expect(page).toHaveURL(/\/login/);
});
