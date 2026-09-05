/** wei-like u256 -> human GEN string. bigint throughout -- GEN's 18-decimal
 * wei amounts routinely exceed Number.MAX_SAFE_INTEGER, a lesson carried
 * over from this author's earlier GenLayer frontends. */
export function formatGen(amountWei: bigint): string {
  if (amountWei === 0n) return "0 GEN";
  const whole = amountWei / 10n ** 18n;
  const frac = amountWei % 10n ** 18n;
  if (whole === 0n && frac < 100000000000000n) return `${amountWei} wei`;
  const gen = Number(whole) + Number(frac) / 1e18;
  return `${gen.toLocaleString(undefined, { maximumFractionDigits: 4 })} GEN`;
}

export function parseGenToWei(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  try {
    return BigInt(whole) * 10n ** 18n + BigInt(fracPadded || "0");
  } catch {
    return null;
  }
}

export function formatDateTime(iso: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function isPast(iso: string, nowMs: number = Date.now()): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return nowMs > t;
}

export function shortAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatSeconds(total: number): string {
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
