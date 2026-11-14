// Update KEY=value lines in the text of a .env file without touching anything else.
// Existing keys are replaced in place (first occurrence; later duplicates removed);
// missing keys are appended. Comments and other lines are kept exactly.
export function upsertEnv(text: string, values: Record<string, string>): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const done = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    const key = m?.[1];
    if (key && key in values) {
      if (done.has(key)) continue; // drop duplicates
      out.push(`${key}=${values[key]}`);
      done.add(key);
    } else {
      out.push(line);
    }
  }
  // Keep a single trailing newline, then append keys that were not present.
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  for (const [k, v] of Object.entries(values)) if (!done.has(k)) out.push(`${k}=${v}`);
  return out.join(eol) + eol;
}
