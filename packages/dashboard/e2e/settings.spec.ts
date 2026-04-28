import { test, expect } from "@playwright/test";
import { setupSettingsMocks, MOCK_SETTINGS } from "./helpers/mock";

test.describe("Settings Page (/settings)", () => {
  // ── 1. 페이지 접근 및 폼 필드 표시 ──────────────────────────────────────

  test("페이지 접근 시 설정 폼 필드가 표시된다", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");

    await expect(content.locator("#apiKey, input[id='apiKey']")).toBeVisible();
    await expect(content.locator("#maxParallel, input[id='maxParallel']")).toBeVisible();
    await expect(content.getByRole("button", { name: /Save/ })).toBeVisible();
  });

  // ── 2. 변경 없음 → Save 버튼 비활성화 ──────────────────────────────────

  test("변경 없을 때 Save 버튼 비활성화 또는 disabled", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");
    await content.locator("#apiKey, input[id='apiKey']").waitFor();

    const saveBtn = content.getByRole("button", { name: /Save/ });
    // Save button should be disabled or have disabled styling when no changes
    const isDisabled = await saveBtn.isDisabled();
    const hasDisabledClass = await saveBtn.evaluate((el) =>
      el.className.includes("opacity-40") || el.className.includes("pointer-events-none"),
    );
    expect(isDisabled || hasDisabledClass).toBe(true);
  });

  // ── 3. API 키 입력 → Save 버튼 활성화 ─────────────────────────────────

  test("API 키 변경 시 Save 버튼 활성화", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");
    const apiKeyInput = content.locator("#apiKey");
    await apiKeyInput.waitFor();

    await apiKeyInput.fill("sk-ant-api03-new-test-key");

    const saveBtn = content.getByRole("button", { name: /Save/ });
    await expect(saveBtn).not.toBeDisabled();
  });

  // ── 4. Save 버튼 클릭 → PUT 요청 ──────────────────────────────────────

  test("Save 버튼 클릭 → PUT /api/settings 요청 전송", async ({ page }) => {
    let saveCalled = false;
    let savedData: Record<string, unknown> = {};

    await setupSettingsMocks(page);

    await page.route("**/api/settings", (route) => {
      if (route.request().method() === "PUT") {
        saveCalled = true;
        try {
          savedData = JSON.parse(route.request().postData() ?? "{}");
        } catch {
          // ignore
        }
        route.fulfill({ json: { ...MOCK_SETTINGS, ...savedData } });
      } else if (route.request().method() === "GET") {
        route.fulfill({ json: MOCK_SETTINGS });
      } else {
        route.continue();
      }
    });

    await page.goto("/settings");

    const content = page.locator(".content-container");
    const apiKeyInput = content.locator("#apiKey");
    await apiKeyInput.waitFor();

    await apiKeyInput.fill("sk-ant-api03-updated-key");

    const saveBtn = content.getByRole("button", { name: /Save/ });
    await saveBtn.click();

    expect(saveCalled).toBe(true);
  });

  // ── 5. src 경로 추가 ────────────────────────────────────────────────────

  test("'경로 추가' 버튼 클릭 → 새 입력란 추가", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");
    await content.locator("#apiKey").waitFor();

    const addPathBtn = content.getByRole("button", { name: /경로 추가|Add/ });
    if (await addPathBtn.isVisible()) {
      const inputsBefore = await content.locator("input[placeholder*='src']").count();
      await addPathBtn.click();
      const inputsAfter = await content.locator("input[placeholder*='src']").count();
      expect(inputsAfter).toBeGreaterThan(inputsBefore);
    }
  });

  // ── 6. src 경로 삭제 ────────────────────────────────────────────────────

  test("경로 삭제 버튼 클릭 → 해당 입력란 제거", async ({ page }) => {
    await setupSettingsMocks(page, {
      ...MOCK_SETTINGS,
      srcPaths: ["src/", "lib/"],
    });
    await page.goto("/settings");

    const content = page.locator(".content-container");
    await content.locator("#apiKey").waitFor();

    const deleteButtons = content.getByRole("button", { name: /삭제|remove|×/ });
    if ((await deleteButtons.count()) > 0) {
      const inputsBefore = await content.locator("input[placeholder*='src/']").count();
      await deleteButtons.first().click();
      const inputsAfter = await content.locator("input[placeholder*='src/']").count();
      expect(inputsAfter).toBeLessThan(inputsBefore);
    }
  });

  // ── 7. 모델 선택 ────────────────────────────────────────────────────────

  test("Sonnet 모델 선택 → 활성 스타일 적용", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");
    await content.locator("#apiKey").waitFor();

    const sonnetBtn = content.getByRole("button", { name: /Sonnet/ });
    if (await sonnetBtn.isVisible()) {
      await sonnetBtn.click();
      await expect(sonnetBtn).toHaveClass(/border-primary/);
    }
  });

  test("Haiku 모델 선택 → 활성 스타일 적용", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");
    await content.locator("#apiKey").waitFor();

    const haikuBtn = content.getByRole("button", { name: /Haiku/ });
    if (await haikuBtn.isVisible()) {
      await haikuBtn.click();
      await expect(haikuBtn).toHaveClass(/border-primary/);
    }
  });

  // ── 8. maxParallel 변경 ─────────────────────────────────────────────────

  test("maxParallel 프리셋 버튼 클릭 → 값 변경", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");
    await content.locator("#maxParallel").waitFor();

    // Click preset button "5"
    const preset5 = content.getByRole("button", { name: /^5$/ });
    if (await preset5.isVisible()) {
      await preset5.click();
      const maxParallelInput = content.locator("#maxParallel");
      await expect(maxParallelInput).toHaveValue("5");
    }
  });

  test("maxParallel 직접 입력 → 값 반영", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");
    const maxParallelInput = content.locator("#maxParallel");
    await maxParallelInput.waitFor();

    await maxParallelInput.fill("4");
    await expect(maxParallelInput).toHaveValue("4");

    const saveBtn = content.getByRole("button", { name: /Save/ });
    await expect(saveBtn).not.toBeDisabled();
  });
});
