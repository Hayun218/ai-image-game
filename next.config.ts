import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 이미지는 next/image 를 쓰지 않는다:
  // - 실제 사진은 Unsplash/Pexels CDN URL을 그대로 hotlink (가이드라인)
  // - AI 사진은 /api/img/[hash] 가 직접 서빙
  poweredByHeader: false,
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
