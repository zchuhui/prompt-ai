import { expect, test } from "@playwright/test";
import { adminPassword, adminUsername, hasAdmin, hasHorizontalOverflow, pngBuffer } from "./support";

test.describe("admin publishing flow", () => {
  test.skip(!hasAdmin, "set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD (local admin only)");

  test("create, upload, publish, check public page, unpublish and delete", async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "runs once on desktop");
    test.setTimeout(180_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const title = `E2E 霓虹 ${Date.now().toString(36)}`;
    const promptText = `${title}, rain soaked neon alley, cinematic, 35mm`;

    await page.goto("/admin/login");
    await page.getByLabel("用户名").fill(adminUsername);
    await page.getByLabel("密码").fill(adminPassword);
    await page.getByRole("button", { name: "登录" }).click();
    await page.waitForURL(/\/admin(\/)?$/);
    await expect(page.getByRole("heading", { name: "概览" })).toBeVisible();

    await page.getByRole("link", { name: "新建草稿" }).first().click();
    await page.waitForURL(/\/admin\/prompts\/[^/]+\/edit$/);
    const editUrl = page.url();

    await page.getByLabel("标题", { exact: true }).fill(title);
    await page.getByLabel("主 Prompt").fill(promptText);
    await page.getByRole("combobox", { name: /^分类/ }).selectOption({ index: 1 });
    await page.getByRole("combobox", { name: /^模型/ }).selectOption({ index: 1 });
    await page.getByRole("button", { name: "从标题生成" }).click();
    const slug = await page.getByLabel("链接", { exact: true }).inputValue();
    await page.getByRole("button", { name: "保存草稿" }).click();
    await expect(page.getByText(/已保存 · v\d+/)).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles([
      { name: "e2e-1.png", mimeType: "image/png", buffer: await pngBuffer(200) },
      { name: "e2e-2.png", mimeType: "image/png", buffer: await pngBuffer(300) },
    ]);
    const images = page.getByRole("list", { name: "图片顺序" }).getByRole("listitem");
    await expect(images).toHaveCount(2, { timeout: 90_000 });
    await expect(images.locator("img")).toHaveCount(2, { timeout: 90_000 });
    await expect(page.getByText(/已保存 · v\d+/)).toBeVisible();

    await page.getByLabel("第 2 张图片的替代文字").fill("第二张测试图");
    await images.nth(1).getByRole("button", { name: "设为封面" }).click();
    await expect(page.getByText("有未保存的修改")).toBeVisible();
    await page.getByRole("button", { name: "发布", exact: true }).click();
    await expect(page.getByRole("button", { name: "下线", exact: true })).toBeVisible({ timeout: 15_000 });
    expect(await hasHorizontalOverflow(page)).toBe(false);

    await page.goto(`/prompts/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await page.getByRole("button", { name: "复制Prompt" }).click();
    await expect(page.getByText("已复制").first()).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(promptText);
    await expect(page.getByRole("button", { name: /^第 \d+ 张$/ })).toHaveCount(2);

    await page.goto(editUrl);
    await page.getByRole("button", { name: "下线", exact: true }).click();
    await expect(page.getByRole("button", { name: "发布", exact: true })).toBeVisible({ timeout: 15_000 });
    const gone = await page.request.get(`/prompts/${slug}`);
    expect(gone.status()).toBe(404);

    await page.getByRole("button", { name: "删除", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "删除", exact: true }).click();
    await page.waitForURL(/\/admin\/prompts$/);
  });
});
