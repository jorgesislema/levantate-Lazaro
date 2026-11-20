import { redact } from "./redact.js";

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Strip terminal control characters, including ANSI escapes. */
export const stripControls = (s: string): string =>
  s.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/\u001b[@-_]/g, "").replace(CONTROL, "");

const ABS_PATH = /(?:[A-Za-z]:[\\/][^\s"'<>|]*|\/(?:home|Users|root|var|tmp|etc|opt|mnt)\/[^\s"'<>|]*)/g;
const REMOTE = /(?:https?:\/\/[^\s"'<>]*@[^\s"'<>]*|git@[\w.-]+:[^\s"'<>]*|ssh:\/\/[^\s"'<>]*)/g;

/** Text safe to share: secrets, emails, absolute paths, remotes and control characters removed. */
export function shareable(s: string, max = 200): string {
  const cleaned = stripControls(s).replace(REMOTE, "[REMOTE]").replace(ABS_PATH, "[PATH]");
  return redact(cleaned, max);
}
