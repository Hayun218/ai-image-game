#!/usr/bin/env node
// 행사 노트북용 "설치 없는 실행 묶음" 만들기 (Windows).
// 결과: out/ai-or-human/  (폴더째 복사해서 start.bat 더블클릭)  +  out/ai-or-human.zip
//   app/        빌드된 서버 (Next.js standalone, node_modules 포함)
//   app/data/   게임 풀 (images/*.webp, pool.json)
//   node/       node.exe (이 PC 에 설치된 것을 복사)
//   start.bat   서버를 띄우고 브라우저를 연다
// Node·npm·git 설치도, 인터넷도 필요 없다.
//
// 사용: npm run bundle
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, ".next-bundle");
const OUT = path.join(ROOT, "out", "ai-or-human");
const APP = path.join(OUT, "app");
const PORT = 3000;

if (process.platform !== "win32") {
  console.error("이 스크립트는 Windows 용 묶음(node.exe + start.bat)을 만듭니다. Windows 에서 실행하세요.");
  process.exit(1);
}

console.log("1/4 빌드 (standalone)…");
const build = spawnSync(process.execPath, [path.join(ROOT, "node_modules/next/dist/bin/next"), "build"], {
  cwd: ROOT,
  env: { ...process.env, BUNDLE: "1" },
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);

console.log("2/4 앱 복사…");
await rm(OUT, { recursive: true, force: true });
await mkdir(APP, { recursive: true });
// dereference: Windows 에서 standalone 이 절대 경로 정션을 쓰더라도 실제 파일로 복사해서 다른 PC 로 옮길 수 있게 한다
await cp(path.join(DIST, "standalone"), APP, { recursive: true, dereference: true });
await cp(path.join(DIST, "static"), path.join(APP, ".next-bundle", "static"), { recursive: true });
if (existsSync(path.join(ROOT, "public"))) await cp(path.join(ROOT, "public"), path.join(APP, "public"), { recursive: true });

console.log("3/4 풀·Node 복사…");
const pool = JSON.parse(await readFile(path.join(ROOT, "data", "pool.json"), "utf8"));
await rm(path.join(APP, "data"), { recursive: true, force: true });
await mkdir(path.join(APP, "data", "images"), { recursive: true });
await cp(path.join(ROOT, "data", "pool.json"), path.join(APP, "data", "pool.json"));
for (const p of pool.pairs) {
  for (const h of [p.ai.hash, p.human.hash]) {
    await cp(path.join(ROOT, "data", "images", `${h}.webp`), path.join(APP, "data", "images", `${h}.webp`));
  }
}
await mkdir(path.join(OUT, "node"), { recursive: true });
await cp(process.execPath, path.join(OUT, "node", "node.exe"));

// start.bat 은 영문·ASCII 만 쓴다 (한글 Windows 의 cmd 코드페이지 문제를 피하려고)
const bat = [
  "@echo off",
  "title AI or Human",
  'cd /d "%~dp0app"',
  `set PORT=${PORT}`,
  "set HOSTNAME=127.0.0.1",
  "set NODE_ENV=production",
  'set "DATA_DIR=%~dp0app\\data"',
  "echo.",
  `echo   AI or Human?  -  http://localhost:${PORT}`,
  "echo   Keep this window open during the event. Close it to stop the game.",
  "echo   In the browser: F = fullscreen, T = dark/light",
  "echo.",
  `start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:${PORT}"`,
  '"%~dp0node\\node.exe" server.js',
  "echo.",
  `echo   The server stopped. If port ${PORT} is already in use, close the other window and try again.`,
  "pause",
  "",
].join("\r\n");
await writeFile(path.join(OUT, "start.bat"), bat);
await writeFile(
  path.join(OUT, "README.txt"),
  [
    "AI or Human?  (행사용 실행 묶음)",
    "",
    "1. 이 폴더를 통째로 행사 노트북에 복사합니다 (zip 이면 먼저 압축을 풉니다).",
    "2. start.bat 을 더블클릭합니다. 검은 창이 뜨고 3초 뒤 브라우저가 열립니다.",
    "   - Windows 가 '알 수 없는 게시자' 경고를 띄우면 [추가 정보] → [실행] 을 누릅니다.",
    "   - 방화벽 창이 뜨면 [취소] 를 눌러도 됩니다 (이 PC 안에서만 접속합니다).",
    "3. 브라우저에서 F 키로 전체화면, T 키로 다크/라이트를 바꿉니다.",
    "4. 끝낼 때는 검은 창을 닫습니다.",
    "",
    "인터넷, Node, npm 설치는 필요 없습니다. 검은 창은 행사 내내 켜 두세요.",
    `쌍 ${pool.pairs.length}개가 들어 있습니다.`,
    "",
  ].join("\r\n"),
);

console.log("4/4 zip…");
const zip = path.join(ROOT, "out", "ai-or-human.zip");
await rm(zip, { force: true });
// Windows 10+ 에 기본 포함된 tar(bsdtar)로 zip 을 만든다. 이미지라 압축은 거의 안 되지만 파일 하나로 옮기기 쉽다
execFileSync("tar", ["-a", "-c", "-f", zip, "-C", path.join(ROOT, "out"), "ai-or-human"], { stdio: "inherit" });
console.log(`✓ ${path.relative(ROOT, OUT)}\\start.bat`);
console.log(`✓ ${path.relative(ROOT, zip)}`);
