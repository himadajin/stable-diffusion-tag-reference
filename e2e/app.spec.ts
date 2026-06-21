import { expect, test } from "@playwright/test";

test("category browsing, search, and copy workflow", async ({ context, isMobile, page }) => {
  test.skip(isMobile, "desktop layout coverage");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  await expect(page.getByRole("button", { name: /品質/ })).toBeVisible();
  await page.getByRole("button", { name: /品質/ }).click();
  await expect(page.getByRole("heading", { name: "品質" })).toBeVisible();
  await expect(page.getByText("masterpiece").first()).toBeVisible();

  await page.getByRole("button", { name: "masterpiece をコピー" }).first().click();
  await expect(page.getByRole("main").getByText("コピーしました")).toBeVisible();

  await page.getByRole("button", { name: "masterpiece を選択リストに追加" }).first().click();
  await expect(page.getByLabel("一時選択リスト").getByText("masterpiece")).toBeVisible();

  await page.locator('input[aria-label="タグ検索"]:visible').fill("cinematic lighting");
  await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("columnheader", { name: "カテゴリ文脈" })).toBeVisible();
  await page.getByRole("button", { name: "cinematic lighting を選択リストに追加" }).first().click();
  await expect(page.getByLabel("一時選択リスト").getByText("cinematic lighting")).toBeVisible();

  await page.getByRole("button", { name: "まとめてコピー" }).click();
  await expect(page.getByRole("main").getByText("選択タグをコピーしました")).toBeVisible();
});

test("mobile keeps category, tag, search, and selection surfaces available", async ({ context, isMobile, page }) => {
  test.skip(!isMobile, "mobile layout coverage");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  await expect(page.getByRole("tab", { name: "カテゴリ" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "タグ" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /選択/ })).toBeVisible();

  await page.getByRole("tab", { name: "カテゴリ" }).click();
  await page.getByRole("button", { name: /品質/ }).click();
  await page.getByRole("tab", { name: "タグ" }).click();
  await expect(page.getByRole("heading", { name: "品質" })).toBeVisible();

  await page.locator('input[aria-label="タグ検索"]:visible').fill("masterpiece");
  await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible();
  await page
    .locator('.mobile-layout .mobile-tag-list button[aria-label="masterpiece を選択リストに追加"]')
    .click();
  await page.getByRole("tab", { name: /選択/ }).click();
  await expect(page.locator(".mobile-layout").getByLabel("一時選択リスト").getByText("masterpiece")).toBeVisible();
});
