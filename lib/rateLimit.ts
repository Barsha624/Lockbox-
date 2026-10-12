/**
 * A tiny in-memory counter used to slow down password guessing and spam sign-ups.
 *
 * Known limit: it lives in one server process. If the app runs as several copies (or on serverless),
 * each copy counts separately, so treat this as a speed bump, not a guarantee. A shared store such as
 * DynamoDB or Redis is the upgrade path.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

function prune(now: number) {
  if (hits.size < 2000) return;
  for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
}

/** True when this key has already reached `max` recorded hits inside its window. */
export function tooMany(key: string, max: number): boolean {
  const entry = hits.get(key);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    hits.delete(key);
    return false;
  }
  return entry.count >= max;
}

/** Counts one hit. The window starts at the first hit. */
export function addHit(key: string, windowMs: number): void {
  const now = Date.now();
  prune(now);
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) hits.set(key, { count: 1, resetAt: now + windowMs });
  else entry.count++;
}

export function clearHits(key: string): void {
  hits.delete(key);
}
