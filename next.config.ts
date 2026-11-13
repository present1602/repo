import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      // CSS Modules는 원래의 클래스 이름 매핑을 유지한다.
      // Tailwind 로더가 일반 CSS로 바꾸지 않도록 대상에서 제외한다.
      "*.css": {
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
