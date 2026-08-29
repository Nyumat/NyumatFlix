import { expect, type Page } from "@playwright/test";

export const createE2eEmail = (): string =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@nyumatflix.test`;

export const expectLoginRedirect = async (
  page: Page,
  callbackPath: string,
): Promise<void> => {
  const encoded = encodeURIComponent(callbackPath);
  await expect(page).toHaveURL(
    new RegExp(`/login(?:\\?callbackUrl=${encoded})?$`),
  );
};

export const completeMagicLinkSignIn = async (
  page: Page,
  email: string,
  expectedPath: string,
): Promise<void> => {
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Continue with email" }).click();

  const expectedUrl = new RegExp(
    `${expectedPath.replaceAll("/", "\\/")}(?:\\?.*)?$`,
  );

  await page.waitForURL(
    (url) =>
      url.pathname.includes("/login/verify") || url.pathname === expectedPath,
    { timeout: 30_000 },
  );

  if (page.url().includes("/login/verify")) {
    const autoRedirect = page.waitForURL(expectedUrl, { timeout: 30_000 });
    const manualFallback = page
      .getByRole("link", { name: "Open magic link" })
      .click()
      .then(() => page.waitForURL(expectedUrl, { timeout: 30_000 }));

    await Promise.race([autoRedirect, manualFallback]);
  }

  await expect(page).toHaveURL(expectedUrl);
  await expect(page.locator("#user-avatar-menu-trigger")).toBeVisible();
};

export const signOutFromNavbar = async (page: Page): Promise<void> => {
  await page.locator("#user-avatar-menu-trigger").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/(?:\?.*)?$/);
  await expect(page.locator("#user-avatar-menu-trigger")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
};
