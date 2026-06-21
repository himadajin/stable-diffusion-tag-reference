import { expect, test } from "@playwright/test";

test("category browsing, search, and copy workflow", async ({ context, isMobile, page }) => {
  test.skip(isMobile, "desktop layout coverage");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  await expect(page.getByRole("button", { name: /品質/ })).toBeVisible();
  await page.getByRole("button", { name: /品質/ }).click();
  await expect(page.getByRole("heading", { name: "品質" })).toBeVisible();
  await expect(page.getByText("masterpiece").first()).toBeVisible();

  await page
    .getByLabel("カテゴリ")
    .getByRole("button", { name: /動作・姿勢/ })
    .click();
  await expect(page.getByRole("heading", { name: "動作・姿勢" })).toBeVisible();
  await page
    .getByLabel("動作・姿勢 のサブカテゴリ")
    .getByRole("button", { name: /ジェスチャー/ })
    .click();
  await expect(page.locator(".current-section-bar")).toContainText("ジェスチャー");

  await page.getByRole("button", { name: /品質/ }).click();
  await page.getByRole("button", { name: "masterpiece をコピー" }).first().click();
  await expect(page.getByRole("main").getByText("コピーしました")).toBeVisible();

  await page.getByRole("button", { name: "masterpiece をお気に入りに追加" }).first().click();
  await page
    .getByLabel("カテゴリ")
    .getByRole("button", { name: /お気に入り/ })
    .click();
  await expect(page.getByRole("heading", { name: "お気に入り" })).toBeVisible();
  await expect(page.getByRole("main").getByText("masterpiece")).toBeVisible();

  await page.locator('input[aria-label="タグ検索"]:visible').fill("cinematic lighting");
  await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("columnheader", { name: "カテゴリ文脈" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "cinematic lighting をコピー" }).first().click();
  await expect(page.getByRole("main").getByText("コピーしました")).toBeVisible();
});

test("mobile keeps category, tag, search, and favorites surfaces available", async ({
  context,
  isMobile,
  page,
}) => {
  test.skip(!isMobile, "mobile layout coverage");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  await expect(page.getByRole("tab", { name: "カテゴリ" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "タグ" })).toBeVisible();

  await page.getByRole("tab", { name: "カテゴリ" }).click();
  await page.getByRole("button", { name: /品質/ }).click();
  await expect(
    page.getByLabel("品質 のサブカテゴリ").getByRole("button", { name: /ポジティブ/ }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "タグ" }).click();
  await expect(page.getByRole("heading", { name: "品質" })).toBeVisible();

  await page.locator('input[aria-label="タグ検索"]:visible').fill("masterpiece");
  await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible();
  await page
    .locator('.mobile-layout .mobile-tag-list button[aria-label="masterpiece をお気に入りに追加"]')
    .click();
  await page.getByRole("tab", { name: "カテゴリ" }).click();
  await page.getByRole("button", { name: /お気に入り/ }).click();
  await page.getByRole("tab", { name: "タグ" }).click();
  await expect(page.locator(".mobile-layout").getByText("masterpiece")).toBeVisible();
});
