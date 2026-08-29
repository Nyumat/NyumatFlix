import { expect, test } from "@playwright/test";
import {
  completeMagicLinkSignIn,
  createE2eEmail,
  expectLoginRedirect,
  signOutFromNavbar,
} from "./helpers/auth";

test.describe("auth flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("redirects protected routes, signs in via dev magic link, and signs out", async ({
    page,
  }) => {
    const email = createE2eEmail();

    await page.goto("/watchlist");
    await expectLoginRedirect(page, "/watchlist");
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();

    await completeMagicLinkSignIn(page, email, "/watchlist");

    await signOutFromNavbar(page);

    await page.goto("/watchlist");
    await expectLoginRedirect(page, "/watchlist");
  });

  test("already signed-in users skip the login form", async ({ page }) => {
    const email = createE2eEmail();

    await page.goto("/login?callbackUrl=%2Fwatchlist");
    await completeMagicLinkSignIn(page, email, "/watchlist");

    await page.goto("/login?callbackUrl=%2Fwatchlist");
    await expect(page).toHaveURL(/\/watchlist$/);
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toHaveCount(0);
  });
});
