/** 発注書の支払回数に応じた割合配分（議事録: 着工時・中間・追加・完了） */
export type PaymentPhase = "着工時" | "中間" | "追加" | "完了";

export type PaymentScheduleItem = {
  phase: PaymentPhase;
  rate: number;
  amount: number;
  due_date: string | null;
};

const SCHEDULE_RATES: Record<string, PaymentPhase[]> = {
  "1回": ["完了"],
  "2回": ["着工時", "完了"],
  "3回": ["着工時", "中間", "完了"],
  "4回": ["着工時", "中間", "追加", "完了"],
  "6回": ["着工時", "中間", "中間", "中間", "追加", "完了"],
  "12回": ["着工時", "中間", "中間", "中間", "中間", "中間", "中間", "中間", "追加", "中間", "中間", "完了"],
};

const PHASE_RATES: Record<number, number[]> = {
  1: [1],
  2: [0.5, 0.5],
  3: [0.4, 0.3, 0.3],
  4: [0.3, 0.3, 0.2, 0.2],
  6: [0.2, 0.15, 0.15, 0.15, 0.15, 0.2],
  12: Array(12).fill(1 / 12),
};

function parseCount(paymentCount: string): number {
  const m = paymentCount.match(/^(\d+)/);
  if (!m) return 1;
  const n = Number(m[1]);
  if (n === 6 || n === 12) return n;
  return n >= 1 && n <= 4 ? n : 1;
}

function distributeDates(
  phases: PaymentPhase[],
  startDate: string | null,
  endDate: string | null,
): (string | null)[] {
  if (!startDate || !endDate || phases.length <= 1) {
    return phases.map((_, i) =>
      i === phases.length - 1 ? endDate : startDate,
    );
  }
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  return phases.map((_, i) => {
    const offset = Math.round((span * i) / Math.max(1, phases.length - 1));
    const d = new Date(start);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  });
}

/** 支払回数と工期からスケジュールを算出 */
export function buildPaymentSchedule(
  amount: number,
  paymentCount: string,
  startDate?: string | null,
  endDate?: string | null,
): PaymentScheduleItem[] {
  const count = parseCount(paymentCount);
  const phases = SCHEDULE_RATES[paymentCount] ?? SCHEDULE_RATES[`${count}回`] ?? SCHEDULE_RATES["1回"];
  const rates = PHASE_RATES[phases.length] ?? PHASE_RATES[1];
  const dates = distributeDates(phases, startDate ?? null, endDate ?? null);

  let allocated = 0;
  return phases.map((phase, i) => {
    const isLast = i === phases.length - 1;
    const itemAmount = isLast
      ? amount - allocated
      : Math.round(amount * rates[i]);
    allocated += itemAmount;
    return {
      phase,
      rate: rates[i],
      amount: itemAmount,
      due_date: dates[i],
    };
  });
}
