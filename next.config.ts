import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 사진은 next/image 를 쓰지 않는다. data/images 의 webp 를 /api/img/[hash] 가 직접 서빙하고,
  // 클라이언트는 new Image() + decode() 로 미리 받아 둔다 (오프라인·즉시 표시).
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
