// Accessibility: axe-core (WCAG 2 A/AA rules) on every main route in both themes.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/career/path", "/career/college", "/mind/meditate", "/body/workout", "/body/diet", "/persona/speak", "/persona/compose", "/settings/integrations", "/review/week", "/ui"];

for (const theme of ["dark", "light"] as const) {
  test.describe(`a11y ${theme}`, () => {
    for (const route of ROUTES) {
      test(`${route}`, async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem("one.theme", t), theme);
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(700); // let in-view animations settle
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("iframe").analyze();
        const issues = r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
        expect(issues, issues.join("\n")).toEqual([]);
      });
    }
  });
}
