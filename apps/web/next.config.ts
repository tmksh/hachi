import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // デプロイ後に古いクライアント JS が残って Server Action ハッシュ不一致になるのを防ぐ
  deploymentId: process.env.NETLIFY_DEPLOY_ID ?? process.env.COMMIT_REF ?? process.env.VERCEL_DEPLOYMENT_ID,
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
