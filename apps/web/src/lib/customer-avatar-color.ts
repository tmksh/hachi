const CUSTOMER_AVATAR_PALETTE = [
  {
    avatarGradient: "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)",
    progressGradient: "linear-gradient(90deg, #c4b5fd 0%, #8b5cf6 100%)",
    start: "#c4b5fd",
    end: "#8b5cf6",
    progress: "#7c3aed",
    track: "#ede9fe",
  },
  {
    avatarGradient: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
    progressGradient: "linear-gradient(90deg, #93c5fd 0%, #3b82f6 100%)",
    start: "#93c5fd",
    end: "#3b82f6",
    progress: "#2563eb",
    track: "#dbeafe",
  },
  {
    avatarGradient: "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)",
    progressGradient: "linear-gradient(90deg, #67e8f9 0%, #06b6d4 100%)",
    start: "#67e8f9",
    end: "#06b6d4",
    progress: "#0891b2",
    track: "#cffafe",
  },
  {
    avatarGradient: "linear-gradient(135deg, #2dd4bf 0%, #0d9488 100%)",
    progressGradient: "linear-gradient(90deg, #5eead4 0%, #14b8a6 100%)",
    start: "#5eead4",
    end: "#14b8a6",
    progress: "#0d9488",
    track: "#ccfbf1",
  },
  {
    avatarGradient: "linear-gradient(135deg, #34d399 0%, #059669 100%)",
    progressGradient: "linear-gradient(90deg, #6ee7b7 0%, #10b981 100%)",
    start: "#6ee7b7",
    end: "#10b981",
    progress: "#059669",
    track: "#d1fae5",
  },
  {
    avatarGradient: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
    progressGradient: "linear-gradient(90deg, #fcd34d 0%, #f59e0b 100%)",
    start: "#fcd34d",
    end: "#f59e0b",
    progress: "#d97706",
    track: "#fef3c7",
  },
  {
    avatarGradient: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)",
    progressGradient: "linear-gradient(90deg, #fdba74 0%, #f97316 100%)",
    start: "#fdba74",
    end: "#f97316",
    progress: "#ea580c",
    track: "#ffedd5",
  },
  {
    avatarGradient: "linear-gradient(135deg, #fb7185 0%, #e11d48 100%)",
    progressGradient: "linear-gradient(90deg, #fda4af 0%, #f43f5e 100%)",
    start: "#fda4af",
    end: "#f43f5e",
    progress: "#e11d48",
    track: "#ffe4e6",
  },
  {
    avatarGradient: "linear-gradient(135deg, #f472b6 0%, #db2777 100%)",
    progressGradient: "linear-gradient(90deg, #f9a8d4 0%, #ec4899 100%)",
    start: "#f9a8d4",
    end: "#ec4899",
    progress: "#db2777",
    track: "#fce7f3",
  },
  {
    avatarGradient: "linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)",
    progressGradient: "linear-gradient(90deg, #a5b4fc 0%, #6366f1 100%)",
    start: "#a5b4fc",
    end: "#6366f1",
    progress: "#4f46e5",
    track: "#e0e7ff",
  },
] as const;

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

export function getCustomerAvatarColor(seed: string) {
  return CUSTOMER_AVATAR_PALETTE[hashSeed(seed) % CUSTOMER_AVATAR_PALETTE.length];
}
