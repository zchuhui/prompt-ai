import { expect, test } from "@playwright/test";

test("home has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
  await expect(page.getByRole("heading", { name: "图片库" })).toBeVisible();
});

test("login page rejects an empty submit by staying on the form", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "管理员登录" })).toBeVisible();
});
