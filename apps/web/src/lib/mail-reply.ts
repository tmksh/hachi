type ReplySourceMessage = {
  direction?: string | null;
  from_address?: string | null;
  to_addresses?: Array<{ address?: string } | string> | null;
};

function normalizeAddress(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const angled = value.match(/<([^>]+)>/);
  const email = (angled?.[1] ?? value).trim();
  return email.includes("@") ? email : "";
}

function addressesFromTo(
  toAddresses: ReplySourceMessage["to_addresses"]
): string[] {
  if (!toAddresses) return [];
  return toAddresses
    .map((item) =>
      normalizeAddress(typeof item === "string" ? item : item.address)
    )
    .filter(Boolean);
}

export function replySubject(subject: string | null | undefined): string {
  const trimmed = (subject ?? "").trim() || "(件名なし)";
  return /^(re|fwd|fw|返)\s*:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

/** 自分以外の直近の差出人、なければ自分以外の宛先 */
export function guessReplyAddress(
  messages: ReplySourceMessage[],
  myEmails: Iterable<string>
): string {
  const mine = new Set(
    [...myEmails].map((e) => e.trim().toLowerCase()).filter(Boolean)
  );

  for (let i = messages.length - 1; i >= 0; i--) {
    const from = normalizeAddress(messages[i]?.from_address);
    if (from && !mine.has(from.toLowerCase())) return from;
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    for (const addr of addressesFromTo(messages[i]?.to_addresses)) {
      if (!mine.has(addr.toLowerCase())) return addr;
    }
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const from = normalizeAddress(messages[i]?.from_address);
    if (from) return from;
    for (const addr of addressesFromTo(messages[i]?.to_addresses)) {
      if (addr) return addr;
    }
  }

  return "";
}
