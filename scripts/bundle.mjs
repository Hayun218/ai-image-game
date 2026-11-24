#!/usr/bin/env node
// 행사 노트북용 "설치 없는 실행 묶음" 만들기. Windows 용과 Mac 용을 함께 만든다.
// 결과 (out/ 아래):
//   ai-or-human-win/  + ai-or-human-win.zip   → start.bat 더블클릭
//   ai-or-human-mac/  + ai-or-human-mac.zip   → 터미널에서 bash start.command
// 각 묶음의 내용:
//   app/        빌드된 서버 (Next.js standalone, node_modules 포함)
//   app/data/   게임 풀 (images/*.webp, pool.json)
//   node/       Node 실행 파일 (Windows: 이 PC 의 node.exe, Mac: nodejs.org 에서 받은 arm64·x64)
// 행사 노트북에는 Node·npm·git 설치도, 인터넷도 필요 없다.
//
// 사용: npm run bundle            (둘 다)
//       npm run bundle -- win     (Windows 용만)   /   npm run bundle -- mac   (Mac 용만)
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, ".next-bundle");
const OUT = path.join(ROOT, "out");
const NODE_CACHE = path.join(ROOT, "data", ".cache", "node");
const PORT = 3000;
const targets = process.argv.slice(2).filter((a) => a === "win" || a === "mac");
if (targets.length === 0) targets.push("win", "mac");

if (process.platform !== "win32") {
  console.error("이 스크립트는 Windows 개발 PC 에서 실행합니다 (Windows 용 node.exe 를 이 PC 에서 복사).");
  process.exit(1);
}

console.log("빌드 (standalone)…");
// next build 가 distDir 에 맞춰 tsconfig.json 을 고쳐 쓰므로, 빌드 뒤에 원래대로 되돌린다
const tsconfigFile = path.join(ROOT, "tsconfig.json");
const tsconfig = await readFile(tsconfigFile);
const build = spawnSync(process.execPath, [path.join(ROOT, "node_modules/next/dist/bin/next"), "build"], {
  cwd: ROOT,
  env: { ...process.env, BUNDLE: "1" },
  stdio: "inherit",
});
await writeFile(tsconfigFile, tsconfig);
if (build.status !== 0) process.exit(build.status ?? 1);

const pool = JSON.parse(await readFile(path.join(ROOT, "data", "pool.json"), "utf8"));

/** 빌드된 앱 + 풀을 dir/app 에 복사 */
async function copyApp(dir) {
  const app = path.join(dir, "app");
  await rm(dir, { recursive: true, force: true });
  await mkdir(app, { recursive: true });
  // dereference: Windows 에서 standalone 이 절대 경로 정션을 쓰더라도 실제 파일로 복사해서 다른 PC 로 옮길 수 있게 한다
  await cp(path.join(DIST, "standalone"), app, { recursive: true, dereference: true });
  await cp(path.join(DIST, "static"), path.join(app, ".next-bundle", "static"), { recursive: true });
  if (existsSync(path.join(ROOT, "public"))) await cp(path.join(ROOT, "public"), path.join(app, "public"), { recursive: true });
  await rm(path.join(app, "data"), { recursive: true, force: true });
  await mkdir(path.join(app, "data", "images"), { recursive: true });
  await cp(path.join(ROOT, "data", "pool.json"), path.join(app, "data", "pool.json"));
  for (const p of pool.pairs) {
    for (const h of [p.ai.hash, p.human.hash]) {
      await cp(path.join(ROOT, "data", "images", `${h}.webp`), path.join(app, "data", "images", `${h}.webp`));
    }
  }
  return app;
}

/** 폴더를 zip 으로 (Windows 10+ 에 기본 포함된 tar 사용. 이미지라 거의 안 줄지만 파일 하나로 옮기기 쉽다) */
function zip(name) {
  const file = path.join(OUT, `${name}.zip`);
  execFileSync("tar", ["-a", "-c", "-f", file, "-C", OUT, name], { stdio: "inherit" });
  console.log(`✓ out\\${name}.zip`);
}

/**
 * Mac 용 zip: 실행 권한(유닉스 모드)을 넣어서 만든다.
 * Windows 의 tar/zip 도구는 권한을 기록하지 못해서, 그대로 풀면 Mac 에서 "permission denied" 가 난다.
 * 그래서 zip 파일을 직접 쓴다 (이미 압축된 webp 는 그대로 저장하고, 나머지는 deflate 로 압축).
 */
async function zipUnix(name, isExecutable) {
  const file = path.join(OUT, `${name}.zip`);
  await rm(file, { force: true });
  const out = createWriteStream(file);
  const write = (buf) => new Promise((res, rej) => out.write(buf, (e) => (e ? rej(e) : res())));
  const central = [];
  let offset = 0;
  const walk = async (rel) => {
    for (const e of (await readdir(path.join(OUT, rel), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) {
        await add(`${r}/`, Buffer.alloc(0), 0o040755);
        await walk(r);
      } else {
        await add(r, await readFile(path.join(OUT, r)), isExecutable(r) ? 0o100755 : 0o100644);
      }
    }
  };
  const add = async (entry, data, mode) => {
    const nameBuf = Buffer.from(entry, "utf8");
    const crc = data.length ? crc32(data) : 0;
    const rawSize = data.length;
    let method = 0;
    if (rawSize > 0 && !entry.endsWith(".webp")) {
      const packed = deflateRawSync(data, { level: 6 });
      if (packed.length < rawSize) {
        data = packed;
        method = 8;
      }
    }
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4); // 풀 때 필요한 버전
    head.writeUInt16LE(0x0800, 6); // 파일 이름은 UTF-8
    head.writeUInt16LE(method, 8); // 0 = 저장, 8 = deflate
    head.writeUInt16LE(0, 10); // 시각
    head.writeUInt16LE(0x5821, 12); // 날짜 (2024-01-01)
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(data.length, 18);
    head.writeUInt32LE(rawSize, 22);
    head.writeUInt16LE(nameBuf.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE((3 << 8) | 20, 4); // 만든 쪽 = 유닉스 → 외부 속성의 권한을 Mac 이 적용한다
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(method, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0x5821, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(rawSize, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(((mode << 16) | (mode & 0o040000 ? 0x10 : 0)) >>> 0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    await write(head);
    await write(nameBuf);
    if (data.length) await write(data);
    offset += 30 + nameBuf.length + data.length;
  };
  await add(`${name}/`, Buffer.alloc(0), 0o040755);
  await walk(name);
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  await write(cd);
  await write(end);
  await new Promise((res) => out.end(res));
  console.log(`✓ out\\${name}.zip (실행 권한 포함)`);
}
const commonReadme = [
  "",
  "브라우저에서 F 키로 전체화면, T 키로 다크/라이트를 바꿉니다.",
  "인터넷, Node, npm 설치는 필요 없습니다. 실행 창은 행사 내내 켜 두고, 끝낼 때 닫습니다.",
  `쌍 ${pool.pairs.length}개가 들어 있습니다.`,
  "",
];

async function bundleWin() {
  const name = "ai-or-human-win";
  const dir = path.join(OUT, name);
  console.log(`[${name}] 복사…`);
  await copyApp(dir);
  await mkdir(path.join(dir, "node"), { recursive: true });
  await cp(process.execPath, path.join(dir, "node", "node.exe"));
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
  await writeFile(path.join(dir, "start.bat"), bat);
  await writeFile(
    path.join(dir, "README.txt"),
    [
      "AI or Human?  (행사용 실행 묶음 · Windows)",
      "",
      "1. 이 폴더를 통째로 행사 노트북에 복사합니다 (zip 이면 먼저 압축을 풉니다).",
      "2. start.bat 을 더블클릭합니다. 검은 창이 뜨고 3초 뒤 브라우저가 열립니다.",
      "   - Windows 가 '알 수 없는 게시자' 경고를 띄우면 [추가 정보] → [실행] 을 누릅니다.",
      "   - 방화벽 창이 뜨면 [취소] 를 눌러도 됩니다 (이 PC 안에서만 접속합니다).",
      ...commonReadme,
    ].join("\r\n"),
  );
  zip(name);
}

/** nodejs.org 에서 Mac 용 Node 를 받아(이 PC 의 Node 와 같은 버전) 체크섬을 확인하고 bin/node 만 꺼낸다 */
async function macNode(arch) {
  const v = process.version; // 예: v26.13.1
  const base = `node-${v}-darwin-${arch}`;
  const tgz = path.join(NODE_CACHE, `${base}.tar.gz`);
  await mkdir(NODE_CACHE, { recursive: true });
  const sums = await (await fetch(`https://nodejs.org/dist/${v}/SHASUMS256.txt`)).text();
  const want = sums.split("\n").find((l) => l.endsWith(`  ${base}.tar.gz`))?.split(/\s+/)[0];
  if (!want) throw new Error(`nodejs.org 에 ${base}.tar.gz 가 없습니다`);
  const sha = async () => createHash("sha256").update(await readFile(tgz)).digest("hex");
  if (!existsSync(tgz) || (await sha()) !== want) {
    console.log(`  ↓ ${base}.tar.gz (nodejs.org)`);
    const res = await fetch(`https://nodejs.org/dist/${v}/${base}.tar.gz`);
    if (!res.ok) throw new Error(`${res.status} ${base}.tar.gz`);
    await writeFile(tgz, Buffer.from(await res.arrayBuffer()));
    if ((await sha()) !== want) throw new Error(`체크섬이 맞지 않습니다: ${base}.tar.gz`);
  }
  const tmp = path.join(NODE_CACHE, base);
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  execFileSync("tar", ["-x", "-z", "-f", tgz, "-C", tmp, `${base}/bin/node`], { stdio: "inherit" });
  return path.join(tmp, base, "bin", "node");
}

async function bundleMac() {
  const name = "ai-or-human-mac";
  const dir = path.join(OUT, name);
  console.log(`[${name}] 복사…`);
  const app = await copyApp(dir);
  // Windows 용 네이티브 모듈은 Mac 에서 쓸 수 없다. 이 게임은 next/image 를 쓰지 않아 sharp 가 필요 없으므로 뺀다
  await rm(path.join(app, "node_modules", "sharp"), { recursive: true, force: true });
  await rm(path.join(app, "node_modules", "@img"), { recursive: true, force: true });
  for (const arch of ["arm64", "x64"]) {
    await mkdir(path.join(dir, "node", arch), { recursive: true });
    await cp(await macNode(arch), path.join(dir, "node", arch, "node"));
  }
  // zip 에 실행 권한을 넣지만, 다른 도구로 풀어 권한이 빠진 경우에도 되도록 스크립트가 다시 권한을 준다 (줄바꿈은 LF)
  const sh = [
    "#!/bin/bash",
    "# AI or Human? - Mac 용 실행 스크립트. 더블클릭하거나, 터미널에서:  bash start.command",
    'DIR="$(cd "$(dirname "$0")" && pwd)"',
    'case "$(uname -m)" in arm64) ARCH=arm64 ;; *) ARCH=x64 ;; esac',
    'NODE="$DIR/node/$ARCH/node"',
    'chmod +x "$NODE" "$DIR/start.command" 2>/dev/null',
    'if [ ! -x "$NODE" ]; then echo "node 실행 권한을 줄 수 없습니다. 폴더를 홈 폴더(예: 문서)로 옮긴 뒤 다시 실행해 보세요: $NODE"; exit 1; fi',
    'xattr -dr com.apple.quarantine "$DIR" 2>/dev/null',
    'cd "$DIR/app" || exit 1',
    `export PORT=${PORT} HOSTNAME=127.0.0.1 NODE_ENV=production DATA_DIR="$DIR/app/data"`,
    "echo",
    `echo "  AI or Human?  -  http://localhost:${PORT}"`,
    'echo "  이 창은 행사 내내 켜 두세요. 끝낼 때는 Ctrl+C 또는 창 닫기."',
    'echo "  브라우저: F = 전체화면, T = 다크/라이트"',
    "echo",
    `(sleep 3; open "http://localhost:${PORT}") &`,
    '"$NODE" server.js',
    "",
  ].join("\n");
  await writeFile(path.join(dir, "start.command"), sh);
  await writeFile(
    path.join(dir, "README.txt"),
    [
      "AI or Human?  (행사용 실행 묶음 · Mac)",
      "",
      "1. zip 을 풀어 폴더를 통째로 행사 맥북에 둡니다.",
      "2. start.command 를 더블클릭합니다. (처음에는 우클릭 → [열기] → [열기] 를 눌러야 할 수 있습니다.)",
      "3. 3초 뒤 브라우저가 열립니다.",
      "",
      "안 될 때 (permission denied 등): 터미널(Terminal) 앱을 열고,",
      "bash 라고 치고 한 칸 띄운 뒤 start.command 파일을 터미널 창으로 끌어다 놓고 Enter 를 누릅니다.",
      "   (예:  bash /Users/이름/Downloads/ai-or-human-mac/start.command )",
      "   - '개발자를 확인할 수 없습니다' 경고가 뜨면: 시스템 설정 → 개인정보 보호 및 보안 → [그래도 열기]",
      "   - Apple Silicon(M1 이후)과 Intel 맥 모두 지원합니다 (자동 선택).",
      ...commonReadme,
    ].join("\n"),
  );
  await zipUnix(name, (r) => r.endsWith("/start.command") || /\/node\/(arm64|x64)\/node$/.test(r));
}

await mkdir(OUT, { recursive: true });
if (targets.includes("win")) await bundleWin();
if (targets.includes("mac")) await bundleMac();
