const STORAGE_KEY = 'sai_rate_limit';
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface Attempt {
  timestamp: number;
}

function getAttempts(): Attempt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const attempts: Attempt[] = JSON.parse(raw);
    const now = Date.now();
    return attempts.filter((a) => now - a.timestamp < WINDOW_MS);
  } catch {
    return [];
  }
}

function saveAttempts(attempts: Attempt[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
}

export function recordFailedAttempt(): void {
  const attempts = getAttempts();
  attempts.push({ timestamp: Date.now() });
  saveAttempts(attempts);
}

export function resetAttempts(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isLocked(): boolean {
  return getAttempts().length >= MAX_ATTEMPTS;
}

export function getLockoutSeconds(): number {
  const attempts = getAttempts();
  if (attempts.length < MAX_ATTEMPTS) return 0;
  const oldest = Math.min(...attempts.map((a) => a.timestamp));
  const expiresAt = oldest + WINDOW_MS;
  const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

export function getRemainingAttempts(): number {
  return Math.max(0, MAX_ATTEMPTS - getAttempts().length);
}
