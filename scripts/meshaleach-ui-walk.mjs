/**
 * Meshaleach UI walk — Playwright driver for Control Center onboarding.
 *
 * Prerequisites: Vite on BASE (default http://127.0.0.1:5173) with
 * VITE_SOVEREIGN_HOST → Azure host for gate-acl / cardia proxy.
 *
 *   cd scripts && node meshaleach-ui-walk.mjs
 */

import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const SHOT = join(__dirname, "meshaleach-shots");
mkdirSync(SHOT, { recursive: true });

async function shot(page, name) {
  const p = join(SHOT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  📸 ${name}.png`);
}

async function main() {
  console.log("═".repeat(60));
  console.log(" MESHALEACH UI WALK");
  console.log("═".repeat(60));
  console.log(`Base: ${BASE}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(25000);

  await page.goto(BASE + "/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // ── Phase 1 ──────────────────────────────────────────────────────────
  console.log("[1/4] Broken Genesis — stabilize Llull circuit");
  await page.goto(BASE + "/onboarding/broken-genesis");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800);
  await shot(page, "01-broken-genesis");

  // Floors THEO20 / TECHNO30 / COSMO25; total ∈ (60,95); thr=12 then thr=8 top-up
  // Target: 24 + 32 + 32 = 88
  await page.getByRole("button", { name: "thr=12" }).click();

  async function routeDomain(index, times) {
    const inspect = page.getByRole("button", { name: /Inspect/i }).nth(index);
    await inspect.click();
    await page.waitForTimeout(120);
    const route = page.getByRole("button", { name: /Route \d+/i }).nth(index);
    for (let i = 0; i < times; i++) {
      await route.click();
      await page.waitForTimeout(80);
    }
  }

  // THEO ×2 @12 = 24, TECHNO ×2 @12 = 24, COSMO ×2 @12 = 24
  await routeDomain(0, 2);
  await routeDomain(1, 2);
  await routeDomain(2, 2);
  // top-up TECHNO + COSMO with thr=8 → 24+8=32 each
  await page.getByRole("button", { name: "thr=8" }).click();
  await routeDomain(1, 1);
  await routeDomain(2, 1);

  // Compile immediately — decay will starve floors if we wait
  const seal = page.getByRole("button", { name: /COMPILE CONSTRAINT ENVELOPE/i });
  await seal.waitFor({ state: "visible", timeout: 5000 }).catch(() => null);
  if (await seal.count()) {
    await seal.click();
    console.log("    ✓ COMPILE CONSTRAINT ENVELOPE");
  } else {
    // dump energy status line
    const body = await page.locator("body").innerText();
    console.log("    ⚠ compile not visible");
    const m = body.match(/ALLOCATED[\s\S]{0,40}/);
    if (m) console.log("   ", m[0].replace(/\s+/g, " "));
  }
  await page.waitForTimeout(600);
  await shot(page, "02-phase1-done");

  // ── Phase 2 ──────────────────────────────────────────────────────────
  console.log("[2/4] Shadow Market — halt SYSTEM_REFUSED (T-axis aha)");
  await page.goto(BASE + "/onboarding/shadow-market");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);
  await shot(page, "03-shadow-start");

  let correctHalts = 0;
  const deadline = Date.now() + 55000;
  const haltedIds = new Set();
  while (Date.now() < deadline && correctHalts < 3) {
    // Prefer SYSTEM_REFUSED / yellow refused rows only (T-axis aha)
    const refused = page.locator("text=/SYSTEM_REFUSED|T-REFUSAL|C-DENSITY|X-AUDIT|T-SOVEREIGNTY/i");
    const n = await refused.count();
    for (let i = 0; i < n && correctHalts < 3; i++) {
      const block = refused.nth(i).locator("xpath=ancestor::div[contains(@class,'border') or contains(@class,'card') or contains(@class,'rounded')][1]");
      const halt = block.getByRole("button", { name: /Halt/i });
      if (await halt.count()) {
        const id = await block.innerText().catch(() => String(i));
        if (haltedIds.has(id.slice(0, 80))) continue;
        haltedIds.add(id.slice(0, 80));
        await halt.first().click().catch(() => {});
        correctHalts += 1;
        await page.waitForTimeout(400);
      }
    }
    await page.waitForTimeout(2600);
  }

  const restore = page.getByRole("button", {
    name: /RESTORE COMMUNICATION/i,
  });
  if (await restore.count()) {
    // wait briefly for literacy score
    for (let t = 0; t < 10; t++) {
      if (await restore.first().isEnabled()) break;
      await page.waitForTimeout(500);
    }
    if (await restore.first().isEnabled()) {
      await restore.first().click();
      console.log("    ✓ RESTORE COMMUNICATION MODULE");
    } else {
      console.log("    ⚠ restore disabled (need 3× correct SYSTEM_REFUSED halts)");
    }
  }
  await page.waitForTimeout(500);
  await shot(page, "04-phase2-done");
  console.log(`    halt attempts: ${correctHalts}\n`);

  // ── Phase 3 ──────────────────────────────────────────────────────────
  console.log("[3/4] Archon Gate — ENFORCE CONSTRAINT sequences");
  await page.goto(BASE + "/onboarding/archon-gate");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);
  await shot(page, "05-archon-start");

  async function enforce(labels) {
    for (const label of labels) {
      // buttons like "[T] REFUSE" or "REFUSE"
      const btn = page.getByRole("button", { name: new RegExp(label, "i") });
      await btn.first().click();
      await page.waitForTimeout(150);
    }
    await page.getByRole("button", { name: /ENFORCE CONSTRAINT/i }).click();
    await page.waitForTimeout(700);
  }

  await enforce(["REFUSE", "X-AUDITABILITY", "T-SOVEREIGNTY-DEBT"]);
  console.log("    ✓ attack 1 sequence");
  await shot(page, "06-archon-attack1");
  await enforce(["REFUSE", "X-AUDITABILITY", "C-DENSITY-FLOOR"]);
  console.log("    ✓ attack 2 sequence");
  await page.waitForTimeout(800);
  await shot(page, "07-archon-done");

  const gatesText = await page.locator("body").innerText();
  const gates = gatesText.match(/Gates Defended:\s*(\d+)\s*\/\s*(\d+)/i);
  if (gates) console.log(`    Gates Defended: ${gates[1]}/${gates[2]}`);

  // ── Phase 4 ──────────────────────────────────────────────────────────
  console.log("[4/4] Live Activation Gate");
  await page.goto(BASE + "/onboarding/live-activation");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);
  await shot(page, "08-live-activation");

  const status = await page.locator("body").innerText();
  const meshOk = /Meshaleach|Archon Gate passed|WALLET BOUND/i.test(status);
  const plMatch = status.match(/Local PL:\s*(\d+)/i);
  const bind = page.getByRole("button", { name: /BIND WALLET/i });
  const bindEnabled = (await bind.count()) ? await bind.first().isEnabled() : false;

  console.log(`    status snippet PL: ${plMatch ? plMatch[1] : "?"}`);
  console.log(`    meshaleach/archon ready: ${meshOk || /passed/i.test(status)}`);
  console.log(`    bind enabled: ${bindEnabled}`);

  // Inject mock ethereum for optional bind attempt
  await page.addInitScript(() => {
    /* filled on next nav */
  });

  const store = await page.evaluate(() => {
    const raw = localStorage.getItem("shaliah-onboarding-v1");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  });

  const st = store?.state || store;
  console.log("\n── onboarding store ──");
  console.log(
    JSON.stringify(
      {
        phase1Complete: st?.phase1Complete,
        phase2Complete: st?.phase2Complete,
        phase3Complete: st?.phase3Complete,
        meshaleachVerified: st?.meshaleachVerified,
        plScore: st?.plSnapshot?.score,
        twin: st?.twin
          ? {
              theo: st.twin.theoWeight ?? st.twin.profileWeights?.theoWeight,
              techno: st.twin.technoWeight ?? st.twin.profileWeights?.technoWeight,
              cosmo: st.twin.cosmoWeight ?? st.twin.profileWeights?.cosmoWeight,
            }
          : null,
        boundWallet: st?.boundWallet,
      },
      null,
      2,
    ),
  );

  await shot(page, "09-final");
  await browser.close();

  console.log("\n" + "═".repeat(60));
  console.log(" WALK COMPLETE — screenshots in scripts/meshaleach-shots/");
  console.log("═".repeat(60));
}

main().catch((e) => {
  console.error("WALK FAILED:", e);
  process.exit(1);
});
