#!/usr/bin/env node
// 커밋 전에 스테이징된(또는 추적 중인) 파일에서 비밀값처럼 보이는 문자열을 찾는다.
// 사용: npm run check:secrets          (스테이징된 파일)
//       npm run check:secrets -- --all (추적 중인 전체 파일)
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";

const all = process.argv.includes("--all");
const files = execFileSync(
  "git",
  all ? ["ls-files"] : ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

const ENV_KEYS = ["FREEPIK_API_KEY", "ANTHROPIC_API_KEY", "ADMIN_PASSWORD"];

const PATTERNS = [
  [/sk-ant-[A-Za-z0-9_-]{10,}/, "Anthropic API key"],
  [/\bsk-[A-Za-z0-9]{20,}/, "OpenAI-style key"],
  [/AIza[0-9A-Za-z_-]{30,}/, "Google API key"],
  [/\br8_[A-Za-z0-9]{20,}/, "Replicate token"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "Private key"],
  // KEY=값 형태로 실제 값이 들어간 경우 (.env.example 의 빈 값은 통과)
  [new RegExp(`\\b(${ENV_KEYS.join("|")})\\s*[=:]\\s*["']?[A-Za-z0-9_\\-./+:]{8,}`), "env value assigned"],
];

const SKIP = [/^package-lock\.json$/, /\.(png|jpe?g|webp|gif|ico|woff2?)$/i, /^scripts\/check-secrets\.mjs$/];

let found = 0;
for (const f of files) {
  if (SKIP.some((r) => r.test(f)) || !existsSync(f) || statSync(f).isDirectory()) continue;
  if (/^\.env/.test(f) && f !== ".env.example") {
    console.error(`✗ ${f}: .env 파일은 커밋하면 안 됩니다`);
    found++;
    continue;
  }
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const [re, label] of PATTERNS) {
      if (re.test(line)) {
        // process.env.X 참조나 `${{ secrets.X }}` 는 정상
        if (/process\.env\.|secrets\.|\$\{\{/.test(line)) continue;
        console.error(`✗ ${f}:${i + 1}  [${label}]`);
        found++;
      }
    }
  });
}

if (found) {
  console.error(`\n비밀값 의심 ${found}건. 커밋을 중단하세요.`);
  process.exit(1);
}
console.log(`✓ 비밀값 검사 통과 (${files.length}개 파일)`);
