import { useState } from "react";

/** マウント時の時刻。useQuery の initialData を毎回 Date.now() しない */
export function useQuerySeedAt() {
  const [at] = useState(() => Date.now());
  return at;
}
