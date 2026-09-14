/** A short dwell filters accidental pointer passes; explicit focus/click can run immediately. */
export function createNavigationIntent(run: (href: string) => void, delayMs = 120) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  return {
    cancel,
    schedule(href: string) { cancel(); timer = setTimeout(() => { timer = undefined; run(href); }, delayMs); },
    now(href: string) { cancel(); run(href); },
  };
}
