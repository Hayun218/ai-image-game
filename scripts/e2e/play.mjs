#!/usr/bin/env node
// 실제 서버에 붙어서 게임을 끝까지 플레이하는 E2E 점검.
// 사용: (서버 실행 중) node scripts/e2e/play.mjs [--url http://localhost:3000] [--games 3] [--shots out/dir]
//
// 확인 항목
// - 라운드 화면이 보일 때 두 이미지가 모두 디코드 완료 상태인지 (동시 표시)
// - 키보드(←/→)로 5라운드 진행 → 결과 화면
// - 결과 화면에서 Enter → "준비 중" 없이 곧바로 1라운드 (미리 받기)
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const URL = arg("url", "http://localhost:3000");
const GAMES = Number(arg("games", "3"));
const SHOTS = arg("shots", "");
const WIDTH = Number(arg("width", "1920"));
const HEIGHT = Number(arg("height", "1080"));
// --perfect data/pool.json : 풀 파일로 AI 쪽을 알고 전부 맞힌다 (PASS 화면 점검용)
const PERFECT = arg("perfect", "");
const aiHashes = PERFECT
  ? new Set(JSON.parse(readFileSync(PERFECT, "utf8")).pairs.map((p) => p.ai.hash))
  : null;

if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

// 라운드 래퍼가 opacity-100 이 되는 순간 두 이미지 상태를 기록
await page.addInitScript(() => {
  window.__rounds = [];
  new MutationObserver(() => {
    const slots = document.querySelectorAll('[role="button"][aria-label$="사진"]');
    if (slots.length !== 2) return;
    const wrap = slots[0].parentElement;
    if (!wrap?.classList.contains("opacity-100") || wrap.dataset.seen) return;
    wrap.dataset.seen = "1";
    const imgs = [...slots].map((s) => s.querySelector("img"));
    window.__rounds.push(imgs.map((i) => !!i && i.complete && i.naturalWidth > 0));
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true });
});

await page.goto(URL);
await shot(page, "01-start");
let fail = 0;

for (let g = 0; g < GAMES; g++) {
  const t0 = Date.now();
  if (g === 0) await page.keyboard.press("Enter");
  else {
    await page.waitForTimeout(1600); // 결과 화면 입력 잠금
    await page.keyboard.press("Enter");
    // 미리 받아 둔 게임이므로 "준비 중" 이 보이면 안 된다
    const loadingShown = await page.getByText("준비 중").isVisible().catch(() => false);
    if (loadingShown) {
      console.error(`✗ game ${g + 1}: 다시하기 후 준비 중 화면이 보임`);
      fail++;
    }
  }
  for (let r = 0; r < 5; r++) {
    await page.getByText(`${r + 1} / 5`).waitFor();
    await page.locator(".opacity-100 img").nth(1).waitFor();
    if (g === 0 && r === 0) {
      console.log(`  첫 라운드까지 ${Date.now() - t0}ms`);
      await shot(page, "02-round");
    }
    let key = Math.random() < 0.5 ? "ArrowLeft" : "ArrowRight";
    if (aiHashes) {
      const leftSrc = await page.locator(".opacity-100 img").first().getAttribute("src");
      key = aiHashes.has(leftSrc.split("/").pop()) ? "ArrowLeft" : "ArrowRight";
    }
    await page.keyboard.press(key);
    await page.getByText(/정답!|오답/).waitFor();
    if (g === 0 && r === 0) await shot(page, "03-reveal");
  }
  await page.getByText("다시하기").waitFor({ timeout: 10_000 });
  const passed = await page.getByText("스태프에게").isVisible();
  console.log(`  game ${g + 1}: ${passed ? "PASS" : "FAIL"} (${Date.now() - t0}ms)`);
  if (g === 0) await shot(page, `04-result-${passed ? "pass" : "fail"}`);
}

const rounds = await page.evaluate(() => window.__rounds);
const notReady = rounds.filter((r) => !(r[0] && r[1])).length;
console.log(`라운드 ${rounds.length}개 중 표시 시점에 디코드 안 된 것: ${notReady}`);
if (notReady) fail++;
if (rounds.length !== GAMES * 5) {
  console.error(`✗ 라운드 수 ${rounds.length} != ${GAMES * 5}`);
  fail++;
}
if (errors.length) {
  console.error("브라우저 오류:", errors);
  fail++;
}
await browser.close();
console.log(fail ? `✗ 실패 ${fail}건` : "✓ E2E 통과");
process.exit(fail ? 1 : 0);
