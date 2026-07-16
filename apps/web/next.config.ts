import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // ページ間ナビゲーション時にクライアント側ルーターキャッシュを再利用し、
    // 直近訪問したページへの戻りを高速化する（秒）
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
