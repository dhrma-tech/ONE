// Key flows (brief 16): manifests per app, offline shell, check off a task, log a workout,
// submit the nightly review, add + watch a video, login screen (only when Supabase is configured).
import { expect, test, type Page } from "@playwright/test";

const fresh = async (page: Page, path = "/") => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
};

test.describe("installable apps", () => {
  for (const [path, name, scope] of [
    ["/", "ONE", "/"],
    ["/career/", "ONE Career", "/career/"],
    ["/mind/", "ONE Mind", "/mind/"],
    ["/body/", "ONE Body", "/body/"],
    ["/persona/", "ONE Persona", "/persona/"],
  ] as const) {
    test(`manifest for ${name}`, async ({ page, request }) => {
      await page.goto(path);
      const href = await page.locator('link[rel="manifest"]').getAttribute("href");
      expect(href).toBe(`${scope === "/" ? "" : scope.slice(0, -1)}/manifest.webmanifest`);
      const m = await (await request.get(href!)).json();
      expect(m.name).toBe(name);
      expect(m.scope).toBe(scope);
      expect(m.display).toBe("standalone");
      expect(m.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
      expect((await request.get(m.icons[0].src)).ok()).toBe(true);
    });
  }

  test("section app launched from its start_url stays scoped", async ({ page }) => {
    await page.goto("/career/?app=career");
    await expect(page).toHaveURL(/\/career\/path$/);
    await expect(page.getByRole("link", { name: "Career" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Mind", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Settings" }).first()).toBeVisible();
  });
});

test("offline: the shell still opens", async ({ page, context }) => {
  await fresh(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.goto("/body/water");
  await expect(page.getByRole("heading", { name: /Body/ })).toBeVisible();
  await context.setOffline(false);
});

test("check off a task on Home", async ({ page }) => {
  await fresh(page);
  await page.getByRole("textbox", { name: "New task" }).fill("E2E: write one test");
  await page.getByRole("button", { name: "Add task" }).click();
  const box = page.getByRole("checkbox", { name: "E2E: write one test" });
  await box.click();
  await expect(box).toBeChecked();
});

test("log a workout", async ({ page }) => {
  await fresh(page, "/body/workout");
  await page.getByRole("textbox", { name: "Leg press set 1 kg" }).fill("40");
  await page.getByRole("button", { name: /^Log Full Body/ }).click();
  await expect(page.getByText(/Logged\. Goggins nods\./)).toBeVisible();
  await expect(page.getByText("1 workouts")).toBeVisible();
});

test("submit the nightly review", async ({ page }) => {
  await fresh(page);
  const open = page.getByRole("button", { name: "Open" });
  if (await open.isVisible()) await open.click();
  await page.getByLabel("Went well").fill("Wrote the e2e tests");
  await page.getByLabel("Tomorrow's One Thing").fill("Ship the PWA");
  await page.getByRole("button", { name: /Submit review|Update review/ }).click();
  await expect(page.getByText("Logged. Go sleep, Cooper.")).toBeVisible();
});

test("add a video and open the distraction-free player", async ({ page }) => {
  await fresh(page, "/career/library");
  await page.getByRole("button", { name: "Add video" }).click();
  await page.getByLabel("YouTube URL").fill("https://youtu.be/rfscVS0vtbw");
  await page.getByRole("button", { name: "Fetch" }).click();
  await page.getByLabel("Title").fill("Learn Python - Full Course");
  await page.getByRole("button", { name: "Approve and add" }).click();
  await page.getByRole("tab", { name: /Queue/ }).click();
  await page.getByRole("link", { name: /Learn Python - Full Course/ }).click();
  await expect(page.locator('iframe[src*="youtube-nocookie.com/embed/rfscVS0vtbw"]')).toBeAttached();
  await expect(page.getByText("Press N to note this moment")).toBeVisible();
});

test("login screen appears only when Supabase is configured", async ({ page }) => {
  test.skip(!process.env.VITE_SUPABASE_URL, "Local mode build: no login screen (set Supabase env to test magic link).");
  await fresh(page);
  await expect(page.getByRole("button", { name: "Send magic link" })).toBeVisible();
});
