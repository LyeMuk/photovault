import { test, expect } from "@playwright/test";

// Phase 0 smoke test: the shell loads, the demo banner is visible, and the bottom
// tab bar navigates between screens. Grows into the full onboarding/backup/restore
// flows described in docs/CONTEXT.md §14 as those screens gain real behavior.
test("app shell loads with bottom tabs and the demo banner", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo mode")).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Gallery" })).toBeVisible();
});

test("bottom tabs navigate between screens", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Gallery" }).click();
  await expect(page).toHaveURL(/#\/gallery/);
  await page.getByRole("link", { name: "Backup" }).click();
  await expect(page).toHaveURL(/#\/backup/);
});

test("/ui-kit renders the component catalogue", async ({ page }) => {
  await page.goto("/#/ui-kit");
  await expect(page.getByText("Component catalogue")).toBeVisible();
});
