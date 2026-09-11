export type ScheduleProgressTask = {
  progress?: number | null;
  status?: string | null;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** 工程1件の進捗。完了は 100%、それ以外は progress カラム */
export function taskProgressValue(task: ScheduleProgressTask): number {
  if (task.status === "completed") return 100;
  return clampPercent(Number(task.progress ?? 0));
}

/** 工事ヘッダー用。全工程の平均進捗（整数%） */
export function computeScheduleProgress(tasks: ScheduleProgressTask[]): number {
  if (tasks.length === 0) return 0;
  const sum = tasks.reduce((acc, task) => acc + taskProgressValue(task), 0);
  return Math.round(sum / tasks.length);
}

/** ステータス変更時の進捗。完了=100、未着手=0、進行中は既存値を維持 */
export function progressForStatus(status: string, current?: number | null): number {
  if (status === "completed") return 100;
  if (status === "not_started" || status === "pending") return 0;
  const n = clampPercent(Number(current ?? 0));
  if (status === "in_progress" && n >= 100) return 50;
  return n;
}
