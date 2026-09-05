// Aura always raises with an EXPECTED:/EXTERNAL:/LLM_ERROR: prefix -- this
// strips it for a cleaner user-facing message.
export type ClassifiedError = { message: string; kind: "expected" | "external" | "llm" | "unknown" };

export function classifyError(err: unknown): ClassifiedError {
  const raw = err instanceof Error ? err.message : String(err);
  const match = raw.match(/(EXPECTED|EXTERNAL|LLM_ERROR):\s*(.+)/);
  if (match) {
    const kind = match[1] === "EXPECTED" ? "expected" : match[1] === "EXTERNAL" ? "external" : "llm";
    return { message: match[2].trim(), kind };
  }
  return { message: raw, kind: "unknown" };
}
