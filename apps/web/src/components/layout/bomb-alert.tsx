"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { notifyManagerOfOverload } from "@/lib/actions/notifications";
import { useBrandColor } from "@/hooks/use-brand-color";
import { computeBrandFromHex } from "@/lib/brand-color";

// --- SVG定数 ---
const CX = 200;
const CY = 235;
const R = 62;
const FUSE_BASE_X = CX;
const FUSE_BASE_Y = CY - R;
const FUSE_TIP_X = 218;
const FUSE_TIP_Y = 108;
const FUSE_PATH = `M${FUSE_BASE_X},${FUSE_BASE_Y} C212,153 188,133 ${FUSE_TIP_X},${FUSE_TIP_Y}`;
const SMILE_PATH = `M${CX - 22},${CY + 5} Q${CX},${CY + 28} ${CX + 22},${CY + 5}`;
const SAD_PATH = `M${CX - 22},${CY + 22} Q${CX},${CY} ${CX + 22},${CY + 22}`;

type Stage = "intro" | "fuse" | "sad" | "explode" | "message";

interface BombAlertProps {
  urgentCount: number;
  onDismiss: () => void;
  /** trueの場合、上司への通知送信をスキップする（プレビュー用） */
  preview?: boolean;
}

// パーティクルの基本形状（色はレンダリング時に動的に割り当て）
const PARTICLE_BASE = Array.from({ length: 100 }, (_, i) => {
  const angle = (i / 100) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
  const distance = 80 + Math.random() * 260;
  return {
    id: i,
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
    r: 3 + Math.random() * 15,
    colorIndex: Math.random(), // 0〜1 → カラーパレットで色選択
    duration: 0.4 + Math.random() * 1.3,
    delay: Math.random() * 0.12,
  };
});

// 上方向へ飛び散る小さい火花
const EMBERS = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  dx: (Math.random() - 0.5) * 200,
  dy: -(100 + Math.random() * 220),
  r: 2 + Math.random() * 5,
  duration: 0.7 + Math.random() * 0.7,
  delay: Math.random() * 0.18,
}));

interface ExplosionParticlesProps {
  c1: string; c2: string; c3: string; c4: string; c5: string;
}
function ExplosionParticles({ c1, c2, c3, c4, c5 }: ExplosionParticlesProps) {
  const palette = [c5, c1, c1, c3, c4];
  return (
    <>
      {/* メインパーティクル（gooフィルタでとろける感じに） */}
      <g filter="url(#bomb-goo)">
        {PARTICLE_BASE.map((p) => {
          const fill = palette[Math.floor(p.colorIndex * palette.length)];
          return (
            <motion.circle
              key={p.id}
              cx={CX} cy={CY} r={p.r} fill={fill}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0 }}
              transition={{ duration: p.duration, ease: "easeOut", delay: p.delay }}
            />
          );
        })}
      </g>

      {/* 上向きの細かい火花 */}
      {EMBERS.map((e) => (
        <motion.circle
          key={`ember-${e.id}`}
          cx={CX} cy={CY} r={e.r}
          fill={c4}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: e.dx, y: e.dy, opacity: 0 }}
          transition={{ duration: e.duration, ease: "easeOut", delay: e.delay }}
        />
      ))}

      {/* 衝撃波リング 1 */}
      <motion.circle
        cx={CX} cy={CY} r={8}
        fill="none" stroke={c1} strokeWidth={12} strokeOpacity={0.9}
        animate={{ r: 240, opacity: 0, strokeWidth: 2 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      {/* 衝撃波リング 2 */}
      <motion.circle
        cx={CX} cy={CY} r={6}
        fill="none" stroke={c4} strokeWidth={8} strokeOpacity={0.8}
        animate={{ r: 170, opacity: 0, strokeWidth: 1 }}
        transition={{ duration: 0.55, ease: "easeOut", delay: 0.1 }}
      />
      {/* 衝撃波リング 3 */}
      <motion.circle
        cx={CX} cy={CY} r={4}
        fill="none" stroke={c2} strokeWidth={5} strokeOpacity={0.7}
        animate={{ r: 105, opacity: 0 }}
        transition={{ duration: 0.38, ease: "easeOut", delay: 0.05 }}
      />
    </>
  );
}

const bombVariants = {
  hidden: { scale: 0, y: -60, opacity: 0 },
  visible: {
    scale: 1, y: 0, opacity: 1,
    transition: { type: "spring" as const, stiffness: 180, damping: 14, mass: 1.1 },
  },
  gone: {
    // 爆発直前に一瞬膨らんで消える
    scale: 1.4,
    opacity: 0,
    transition: { duration: 0.09, ease: "easeIn" as const },
  },
};

export function BombAlert({ urgentCount, onDismiss, preview = false }: BombAlertProps) {
  const [stage, setStage] = useState<Stage>("intro");
  const [managerName, setManagerName] = useState<string | null>(null);

  // ブランドカラーを動的取得
  const { hex } = useBrandColor();
  const { light: c3, dark: c2, accent: c4, mid: c1 } = useMemo(() => computeBrandFromHex(hex), [hex]);
  const c5 = c2; // 最暗色としてdarkを流用

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage("fuse"), 1400),
      setTimeout(() => setStage("sad"), 4400),
      setTimeout(() => {
        setStage("explode");
        if (!preview) {
          notifyManagerOfOverload(urgentCount)
            .then((r) => setManagerName(r.managerName))
            .catch(() => {});
        }
      }, 4900),
      setTimeout(() => setStage("message"), 5600),
      setTimeout(() => onDismiss(), 12000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage === "message") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, onDismiss]);

  const bombVisible = stage === "intro" || stage === "fuse" || stage === "sad";
  const fuseVisible = stage === "fuse" || stage === "sad";

  // 爆発時の画面シェイク（キーフレームアニメーション）
  const containerAnimate =
    stage === "explode"
      ? {
          x: [0, -20, 16, -13, 10, -7, 5, -3, 1, 0],
          y: [0, 15, -12, 9, -7, 5, -3, 2, -1, 0],
          opacity: 1,
        }
      : { x: 0, y: 0, opacity: 1 };

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/92 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={containerAnimate}
      transition={
        stage === "explode"
          ? { duration: 0.65, times: [0, 0.08, 0.18, 0.28, 0.38, 0.5, 0.64, 0.78, 0.9, 1] }
          : { opacity: { duration: 0.3 } }
      }
      role="dialog"
      aria-modal="true"
      aria-label="通知が溜まりすぎています"
    >
      {/* ── 白フラッシュ（爆発の瞬間） ── */}
      <AnimatePresence>
        {stage === "explode" && (
          <motion.div
            key="flash-white"
            className="absolute inset-0 bg-white pointer-events-none"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.38 }}
          />
        )}
      </AnimatePresence>

      {/* ── ブランドカラー放射フラッシュ ── */}
      <AnimatePresence>
        {stage === "explode" && (
          <motion.div
            key="flash-brand"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at center, ${c4}cc 0%, ${c1}66 45%, transparent 75%)`,
            }}
            initial={{ opacity: 0, scale: 0.1 }}
            animate={{ opacity: [0, 1, 0.7, 0], scale: [0.1, 1.2, 1.5, 2] }}
            transition={{ duration: 1.3, times: [0, 0.1, 0.4, 1] }}
          />
        )}
      </AnimatePresence>

      {/* ── 爆発後のティント（メッセージ画面まで残る） ── */}
      <AnimatePresence>
        {(stage === "explode" || stage === "message") && (
          <motion.div
            key="tint-brand"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at center, ${c1}2e 0%, transparent 70%)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1 } }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* ── SVGキャンバス ── */}
      <svg
        width={400}
        height={420}
        viewBox="0 0 400 420"
        style={{ overflow: "visible" }}
        aria-hidden="true"
      >
        <defs>
          <filter id="bomb-goo" colorInterpolationFilters="sRGB" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur" mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
            />
          </filter>
        </defs>

        {/* 爆発エフェクト */}
        <AnimatePresence>
          {stage === "explode" && (
            <motion.g key="explosion">
              <ExplosionParticles c1={c1} c2={c2} c3={c3} c4={c4} c5={c5} />
            </motion.g>
          )}
        </AnimatePresence>

        {/* 爆弾本体 */}
        <AnimatePresence>
          {bombVisible && (
            <motion.g
              key="bomb"
              variants={bombVariants}
              initial="hidden"
              animate="visible"
              exit="gone"
              style={{ transformOrigin: `${CX}px ${CY}px` }}
            >
              <ellipse cx={CX} cy={CY + R + 12} rx={52} ry={8} fill="black" opacity={0.14} />
              <circle cx={CX} cy={CY} r={R} fill="black" />
              <circle cx={CX - 19} cy={CY - 14} r={8} fill="white" />
              <circle cx={CX + 19} cy={CY - 14} r={8} fill="white" />
              <circle cx={CX - 16} cy={CY - 11} r={4.5} fill="black" />
              <circle cx={CX + 22} cy={CY - 11} r={4.5} fill="black" />
              <motion.path
                d={SMILE_PATH} fill="none" stroke="white" strokeWidth={7}
                strokeLinecap="round" strokeLinejoin="round"
                animate={{ opacity: stage === "sad" ? 0 : 1 }}
                transition={{ duration: 0.22 }}
              />
              <motion.path
                d={SAD_PATH} fill="none" stroke="white" strokeWidth={7}
                strokeLinecap="round" strokeLinejoin="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: stage === "sad" ? 1 : 0 }}
                transition={{ duration: 0.32, ease: [0.175, 0.885, 0.32, 1.275] }}
              />
              <AnimatePresence>
                {fuseVisible && (
                  <motion.rect
                    key="rim"
                    x={CX - 9} y={CY - R - 14} width={18} height={16} rx={4} fill="#3a3a3a"
                    initial={{ y: CY - R + 10, opacity: 0 }}
                    animate={{ y: CY - R - 14, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 18 }}
                  />
                )}
              </AnimatePresence>
              <AnimatePresence>
                {fuseVisible && (
                  <motion.path
                    key="fuse"
                    d={FUSE_PATH}
                    fill="none" stroke="#2a2a2a" strokeWidth={7} strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>
            </motion.g>
          )}
        </AnimatePresence>

        {/* 火花（導火線を燃えながら進む） */}
        <AnimatePresence>
          {fuseVisible && (
            <motion.g
              key="spark"
              initial={{ x: FUSE_TIP_X, y: FUSE_TIP_Y, opacity: 0 }}
              animate={{ x: FUSE_BASE_X, y: FUSE_BASE_Y, opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{
                x: { duration: 3.0, ease: "linear", delay: 0.55 },
                y: { duration: 3.0, ease: "linear", delay: 0.55 },
                opacity: { duration: 0.12, delay: 0.55 },
              }}
            >
              <polygon
                points="10,0 12.9,8.1 21.6,8.1 14.8,13.1 17.3,21.2 10,16.5 2.7,21.2 5.2,13.1 -1.6,8.1 7.1,8.1"
                fill={c4} stroke={c3} strokeWidth={1.5}
                transform="translate(-10.8, -10.6) scale(0.9)"
              />
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      {/* ── 爆発後メッセージ（画面中央） ── */}
      <AnimatePresence>
        {stage === "message" && (
          <motion.div
            key="message"
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* 件数 */}
            <motion.p
              className="text-2xl font-bold"
              style={{ color: c2 }}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, type: "spring", stiffness: 240, damping: 20 }}
            >
              緊急通知が {urgentCount}件 溜まっていました
            </motion.p>

            {/* 上司通知 */}
            <motion.p
              className="text-base text-gray-500"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              {managerName
                ? `${managerName} さんに連絡が届きました`
                : "上司に通知が届きました"}
            </motion.p>

            {/* ボタン */}
            <motion.button
              onClick={onDismiss}
              className="mt-3 px-8 py-3 rounded-full font-semibold text-base text-white active:scale-95 transition-all shadow-lg"
              style={{ background: `linear-gradient(135deg, ${c3}, ${c2})` }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, type: "spring", stiffness: 240, damping: 22 }}
            >
              今すぐ確認する →
            </motion.button>

            <motion.p
              className="text-xs text-gray-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              Esc キーでも閉じられます
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
