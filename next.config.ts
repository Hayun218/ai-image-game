import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 사진은 next/image 를 쓰지 않는다. data/images 의 webp 를 /api/img/[hash] 가 직접 서빙하고,
  // 클라이언트는 new Image() + decode() 로 미리 받아 둔다 (오프라인·즉시 표시).
  poweredByHeader: false,
  // `npm run bundle` 일 때만: node_modules 없이 실행되는 독립 실행 출력을 따로 만든다 (실행 중인 .next 는 건드리지 않음)
  ...(process.env.BUNDLE
    ? {
        output: "standalone" as const,
        distDir: ".next-bundle",
        // data/ 는 묶음 스크립트가 필요한 것만 직접 복사한다 (작업용 후보 원본 수 GB 가 딸려 가지 않게)
        outputFileTracingExcludes: { "*": ["./data/**/*", "./out/**/*", "./scripts/**/*"] },
      }
    : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
