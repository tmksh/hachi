"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { notifyManagerOfOverload } from "@/lib/actions/notifications";
import { useBrandColor } from "@/hooks/use-brand-color";
import { computeBrandFromHex } from "@/lib/brand-color";

/** 先方提供の爆弾動画（黒背景・約5.8秒・爆発まで含む）。screen 合成で黒を抜く */
const BOMB_VIDEO_SRC = "/bomb-alert.mp4";
const VIDEO_SIZE = 420;
/** 動画が再生できない環境向けのフォールバック（動画尺＋余裕） */
const VIDEO_FALLBACK_MS = 6500;
const AUTO_DISMISS_MS = 7000;

/* 動画中は不透明にする（半透明だと screen 合成の結果が背景とズレて動画の枠が見える） */
const OVERLAY_DARK = "rgba(2, 6, 23, 1)";
const OVERLAY_LIGHT = "rgba(255, 255, 255, 0.92)";

type Stage = "video" | "message";

interface BombAlertProps {
  urgentCount: number;
  onDismiss: () => void;
  /** trueの場合、上司への通知送信をスキップする（プレビュー用） */
  preview?: boolean;
}

export function BombAlert({ urgentCount, onDismiss, preview = false }: BombAlertProps) {
  const [stage, setStage] = useState<Stage>("video");
  const [managerName, setManagerName] = useState<string | null>(null);
  const finishedRef = useRef(false);

  const { hex } = useBrandColor();
  const { light: c3, dark: c2, mid: c1 } = useMemo(() => computeBrandFromHex(hex), [hex]);

  // 動画終了（または再生不可・タイムアウト）でメッセージへ。二重起動は防ぐ
  const finishVideo = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setStage("message");
    if (!preview) {
      notifyManagerOfOverload(urgentCount)
        .then((r) => setManagerName(r.managerName))
        .catch(() => {});
    }
  }, [preview, urgentCount]);

  useEffect(() => {
    const fallback = setTimeout(finishVideo, VIDEO_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [finishVideo]);

  useEffect(() => {
    if (stage !== "message") return;
    const timer = setTimeout(() => onDismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage === "message") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, onDismiss]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center backdrop-blur-sm"
      initial={{ opacity: 0, backgroundColor: OVERLAY_DARK }}
      animate={{ opacity: 1, backgroundColor: stage === "video" ? OVERLAY_DARK : OVERLAY_LIGHT }}
      transition={{ opacity: { duration: 0.3 }, backgroundColor: { duration: 0.5 } }}
      role="dialog"
      aria-modal="true"
      aria-label="通知が溜まりすぎています"
    >
      {/* ── 爆弾動画（先方提供）。黒背景を screen 合成で抜く ── */}
      <AnimatePresence>
        {stage === "video" && (
          <motion.video
            key="bomb-video"
            src={BOMB_VIDEO_SRC}
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={finishVideo}
            onError={finishVideo}
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{
              width: VIDEO_SIZE,
              height: VIDEO_SIZE,
              mixBlendMode: "screen",
              left: `calc(50% - ${VIDEO_SIZE / 2}px)`,
              top: `calc(50% - ${VIDEO_SIZE / 2}px)`,
            }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.35 } }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          />
        )}
      </AnimatePresence>

      {/* ── メッセージ画面のブランドティント ── */}
      <AnimatePresence>
        {stage === "message" && (
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

      {/* ── 動画後メッセージ（画面中央） ── */}
      <AnimatePresence>
        {stage === "message" && (
          <motion.div
            key="message"
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <motion.p
              className="text-2xl font-bold"
              style={{ color: c2 }}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 240, damping: 20 }}
            >
              緊急通知が {urgentCount}件 溜まっていました
            </motion.p>

            <motion.p
              className="text-base text-gray-500"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.4 }}
            >
              {managerName
                ? `${managerName} さんに連絡が届きました`
                : "上司に通知が届きました"}
            </motion.p>

            <motion.button
              onClick={onDismiss}
              className="mt-3 px-8 py-3 rounded-full font-semibold text-base text-white active:scale-95 transition-all shadow-lg"
              style={{ background: `linear-gradient(135deg, ${c3}, ${c2})` }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.54, type: "spring", stiffness: 240, damping: 22 }}
            >
              今すぐ確認する →
            </motion.button>

            <motion.p
              className="text-xs text-gray-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              Esc キーでも閉じられます
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
