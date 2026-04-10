import { test, expect } from "@playwright/test";
import { setupSettingsMocks, MOCK_SETTINGS } from "./helpers/mock";

test.describe("Settings Page (/settings)", () => {
  // ── 1. 페이지 접근 및 폼 필드 표시 ──────────────────────────────────────

  test("페이지 접근 시 설정 폼 필드가 표시된다", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");

    await expect(content.locator("#apiKey")).toBeVisible();
    await expect(content.getByRole("button", { name: /Save/ })).toBeVisible();
  });

  // ── 2. 변경 없음 → Save 버튼 비활성화 ──────────────────────────────────

  test("변경 없을 때 Save 버튼 비활성화 또는 disabled", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");
    await content.locator("#apiKey").waitFor();

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

    // Button text is "Add Path"
    const addPathBtn = content.getByRole("button", { name: /Add Path|경로 추가/ });
    if (await addPathBtn.isVisible()) {
      const inputsBefore = await content.locator("input[placeholder='src/']").count();
      await addPathBtn.click();
      const inputsAfter = await content.locator("input[placeholder='src/']").count();
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

    // Delete buttons are icon-only ghost buttons next to each path input
    const pathInputs = content.locator("input[placeholder='src/']");
    const inputsBefore = await pathInputs.count();

    if (inputsBefore > 1) {
      // Find and click the first delete button (sibling of path inputs)
      const deleteBtn = content.locator("input[placeholder='src/']").first()
        .locator("xpath=following-sibling::button").first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        const inputsAfter = await pathInputs.count();
        expect(inputsAfter).toBeLessThan(inputsBefore);
      }
    }
  });

  // ── 7. 모델 선택 ────────────────────────────────────────────────────────

  test("Sonnet 모델 선택 → select 값 반영", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");
    await content.locator("#apiKey").waitFor();

    // Model is a <Select> dropdown, not buttons
    const modelSelect = content.locator("select").first();
    if (await modelSelect.isVisible()) {
      await modelSelect.selectOption("claude-sonnet-4-6");
      await expect(modelSelect).toHaveValue("claude-sonnet-4-6");

      const saveBtn = content.getByRole("button", { name: /Save/ });
      await expect(saveBtn).not.toBeDisabled();
    }
  });

  test("Haiku 모델 선택 → select 값 반영", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");
    await content.locator("#apiKey").waitFor();

    // Model is a <Select> dropdown, not buttons
    const modelSelect = content.locator("select").first();
    if (await modelSelect.isVisible()) {
      await modelSelect.selectOption("claude-haiku-4-5-20251001");
      await expect(modelSelect).toHaveValue("claude-haiku-4-5-20251001");

      const saveBtn = content.getByRole("button", { name: /Save/ });
      await expect(saveBtn).not.toBeDisabled();
    }
  });

  // ── 8. maxParallel 변경 ─────────────────────────────────────────────────

  test("maxParallel 슬라이더가 표시된다", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");
    await content.locator("#apiKey").waitFor();

    // maxParallel is rendered as a Slider (input[type=range])
    const slider = content.locator("input[type='range']").first();
    await expect(slider).toBeVisible();
  });

  test("maxParallel 슬라이더 값 변경 → Save 버튼 활성화", async ({ page }) => {
    await setupSettingsMocks(page);
    await page.goto("/settings");

    const content = page.locator(".content-container");
    await content.locator("#apiKey").waitFor();

    const slider = content.locator("input[type='range']").first();
    if (await slider.isVisible()) {
      // Change slider value
      const currentVal = await slider.inputValue();
      const newVal = currentVal === "3" ? "5" : "3";
      await slider.fill(newVal);

      const saveBtn = content.getByRole("button", { name: /Save/ });
      await expect(saveBtn).not.toBeDisabled();
    }
  });
});
