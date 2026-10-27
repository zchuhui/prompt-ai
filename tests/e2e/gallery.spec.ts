import { expect, test } from "@playwright/test";
import { AdminApi, hasAdmin, hasHorizontalOverflow } from "./support";

async function firstPromptPath(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/");
  const href = await page.locator('a[href^="/prompts/"]').first().getAttribute("href");
  if (!href) {
    throw new Error("no published prompts; run pnpm demo:content first");
  }
  return href;
}

test("public pages have no horizontal overflow", async ({ page }) => {
  const detail = await firstPromptPath(page);
  for (const path of ["/", detail, "/collections", "/about", "/does-not-exist"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    expect(await hasHorizontalOverflow(page), `overflow on ${path}`).toBe(false);
  }
  await page.goto("/");
  await expect(page.getByRole("search")).toBeVisible();
});

test("searching keeps the selected tag filter", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "filters live in a sheet on mobile");
  await page.goto("/");
  const tagLink = page.locator('a[href*="tags="]:visible').first();
  test.skip((await tagLink.count()) === 0, "no tags on the home page");
  await tagLink.click();
  await page.waitForURL(/tags=/);
  const tags = new URL(page.url()).searchParams.get("tags");
  const search = page.getByRole("searchbox").or(page.getByLabel("搜索标题、简介、提示词或标签")).first();
  await search.fill("light");
  await search.press("Enter");
  await page.waitForURL(/q=light/);
  expect(new URL(page.url()).searchParams.get("tags")).toBe(tags);
});

test("detail page copies the prompt and pages the lightbox with the keyboard", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "keyboard and clipboard checks run on desktop only");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const detail = await firstPromptPath(page);
  await page.goto(detail);

  await page.getByRole("button", { name: "复制Prompt" }).click();
  await expect(page.getByText("已复制").first()).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.length).toBeGreaterThan(0);

  const counter = page.getByText(/^\d+ \/ \d+$/).first();
  test.skip((await counter.count()) === 0, "this prompt has a single image");
  await page.getByRole("button", { name: /^放大查看/ }).click();
  const dialog = page.getByRole("dialog", { name: /图片查看/ });
  await expect(dialog).toBeVisible();
  const before = await dialog.locator("img").first().getAttribute("src");
  await page.keyboard.press("ArrowRight");
  await expect(dialog.locator("img").first()).not.toHaveAttribute("src", before ?? "");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test.describe("gallery feed", () => {
  let api: AdminApi | null = null;
  let created: string[] = [];

  test.beforeAll(async ({}, testInfo) => {
    if (testInfo.project.name !== "desktop" || !hasAdmin) {
      return;
    }
    testInfo.setTimeout(240_000);
    api = await AdminApi.login();
    const missing = 26 - (await api.publishedTotal());
    if (missing > 0) {
      created = await api.createPublished(missing, `E2E feed ${Date.now().toString(36)}`);
    }
  });

  test.afterAll(async () => {
    if (api) {
      await api.remove(created);
      await api.dispose();
    }
  });

  test("load more, open a card, then back restores the list and position", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "runs once on desktop");
    test.skip(!hasAdmin, "set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to seed enough prompts");
    await page.goto("/");
    const counter = page.getByText(/^\d+ \/ \d+$/);
    const initial = await counter.textContent();
    await page.getByRole("link", { name: "加载更多" }).click();
    await expect(counter).not.toHaveText(initial ?? "");
    const loaded = await counter.textContent();

    const cards = page.locator('a[href^="/prompts/"]');
    const target = cards.nth((await cards.count()) - 2);
    await target.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 200))));
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(200);
    await target.click();
    await page.waitForURL(/\/prompts\//);

    await page.goBack();
    await expect(counter).toHaveText(loaded ?? "");
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      .toBeGreaterThan(scrollY - 150);
  });
});

test("login page renders the form", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "管理员登录" })).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
});
