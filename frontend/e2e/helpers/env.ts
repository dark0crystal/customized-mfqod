import fs from 'node:fs';
import path from 'node:path';

export const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3100').replace(/\/$/, '');
export const API_URL = (process.env.API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export type QaCredentials = { email: string; password: string; username: string; user_id: string };

/**
 * QA super-admin credentials. Looked up in $QA_CREDENTIALS, then e2e/.auth/qa-credentials.json
 * (git-ignored). Never commit credentials.
 */
export function credentialsPath(): string {
  return process.env.QA_CREDENTIALS || path.resolve(__dirname, '..', '.auth', 'qa-credentials.json');
}

export function loadCredentials(): QaCredentials | null {
  const p = credentialsPath();
  if (!fs.existsSync(p)) return null;
  try {
    const c = JSON.parse(fs.readFileSync(p, 'utf8'));
    return c?.email && c?.password ? (c as QaCredentials) : null;
  } catch {
    return null;
  }
}

export const NO_CREDS_REASON = 'QA credentials not found (set QA_CREDENTIALS=/path/qa-credentials.json)';

/** Hosts that do NOT count as external for the offline check. */
export function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const u of [BASE_URL, API_URL, 'http://127.0.0.1:8000', 'http://localhost:8000']) hosts.add(new URL(u).host);
  for (const extra of (process.env.ALLOWED_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean)) hosts.add(extra);
  return hosts;
}

export function isExternal(url: string): boolean {
  if (!/^https?:|^wss?:/i.test(url)) return false; // data:, blob:, about:, chrome-extension:
  return !allowedHosts().has(new URL(url).host);
}
