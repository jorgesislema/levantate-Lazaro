const SECRET =
  /((?:api[_-]?key|secret|token|passwd|password|private[_-]?key)\w*\s*[=:]\s*)(["']?)([^\s"']{4,})\2/gi;
const KNOWN = /\b(AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,})\b/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

export function hasSecretLead(s: string): boolean {
  SECRET.lastIndex = 0;
  const hit = SECRET.test(s);
  SECRET.lastIndex = 0;
  return hit || new RegExp(KNOWN.source).test(s);
}

/** Redact secrets and emails, strip control characters, cap length. */
export function redact(s: string, max = 80): string {
  const out = s
    .replace(SECRET, (_m, p: string, q: string) => `${p}${q}[REDACTED]${q}`)
    .replace(KNOWN, "[REDACTED]")
    .replace(EMAIL, "[EMAIL]")
    .replace(CONTROL, "")
    .trim();
  return out.length > max ? out.slice(0, max - 1) + "…" : out;
}
