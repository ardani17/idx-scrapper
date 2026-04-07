// Key Manager — storage, generation, validation, daily usage, rate limiting
// Async file I/O using Bun APIs with file permission 0600

import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { TIERS, type TierName, isValidTier } from './tier-config.ts';
import { logger } from '../utils/logger.ts';

// ── Types ───────────────────────────────────────

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  tier: TierName;
  email?: string;
  rateLimit: number;
  dailyLimit: number;
  active: boolean;
  createdAt: string;
  expiresAt?: string;
  lastUsed?: string;
}

interface KeysStore {
  keys: ApiKey[];
}

interface DailyUsage {
  date: string;
  counts: Record<string, number>;
}

export interface KeyValidationResult {
  valid: boolean;
  key?: ApiKey;
  error?: string;
}

export interface RateCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  dailyRemaining: number;
  dailyResetAt: number;
  error?: string;
}

// ── Data directory ──────────────────────────────

const DATA_DIR = join(import.meta.dir, '..', '..', 'data');
const KEYS_PATH = join(DATA_DIR, 'api-keys.json');
const USAGE_PATH = join(DATA_DIR, 'daily-usage.json');
const FILE_MODE = 0o600;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

// ── Async Keys storage (Bun APIs) ───────────────

async function readKeysStore(): Promise<KeysStore> {
  ensureDataDir();
  const file = Bun.file(KEYS_PATH);
  if (!(await file.exists())) return { keys: [] };
  try {
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return { keys: [] };
  }
}

async function writeKeysStore(store: KeysStore): Promise<void> {
  ensureDataDir();
  await Bun.write(KEYS_PATH, JSON.stringify(store, null, 2), { mode: FILE_MODE });
}

// ── Async Daily usage storage (Bun APIs) ────────

async function readDailyUsage(): Promise<DailyUsage> {
  ensureDataDir();
  const file = Bun.file(USAGE_PATH);
  if (!(await file.exists())) return { date: getTodayWib(), counts: {} };
  try {
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return { date: getTodayWib(), counts: {} };
  }
}

async function writeDailyUsage(usage: DailyUsage): Promise<void> {
  ensureDataDir();
  await Bun.write(USAGE_PATH, JSON.stringify(usage, null, 2), { mode: FILE_MODE });
}

// ── Time helpers (WIB = UTC+7) ──────────────────

function getTodayWib(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wib = new Date(utc + 7 * 3600_000);
  return wib.toISOString().slice(0, 10);
}

export function getMidnightResetWib(): number {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibNow = new Date(utc + 7 * 3600_000);
  const tomorrow = new Date(wibNow);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.getTime() - 7 * 3600_000;
}

// ── In-memory rate limiter (per key) ────────────

interface RateWindow {
  count: number;
  windowStart: number;
}

const rateWindows = new Map<string, RateWindow>();
const RATE_WINDOW_MS = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [k, e] of rateWindows) {
    if (now - e.windowStart >= RATE_WINDOW_MS) rateWindows.delete(k);
  }
}, 300_000).unref();

// ── Crypto helpers ──────────────────────────────

function randomHex(length: number): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateId(): string {
  return randomHex(12);
}

// ── Legacy API_KEYS support ─────────────────────

function getLegacyKeys(): string[] {
  const env = process.env.API_KEYS;
  if (!env) return [];
  return env.split(',').map((k) => k.trim()).filter(Boolean);
}

// ── Mask key for display ────────────────────────
// Show first 10 characters + "..." + last 4 characters

export function maskKey(key: string): string {
  if (key.length <= 14) return key;
  return key.slice(0, 10) + '...' + key.slice(-4);
}

// ── Public API (all async) ──────────────────────

export async function generateKey(opts: {
  name: string;
  tier: TierName;
  email?: string;
  rateLimit?: number;
  dailyLimit?: number;
}): Promise<ApiKey> {
  const tierConfig = TIERS[opts.tier] as { rateLimit: number; dailyLimit: number };
  const id = generateId();
  const key = `idsk_live_${randomHex(32)}`;

  const apiKey: ApiKey = {
    id,
    key,
    name: opts.name,
    tier: opts.tier,
    email: opts.email,
    rateLimit: opts.rateLimit ?? tierConfig.rateLimit,
    dailyLimit: opts.dailyLimit ?? tierConfig.dailyLimit,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const store = await readKeysStore();
  store.keys.push(apiKey);
  await writeKeysStore(store);

  logger.info('Key generated', { id, tier: opts.tier });
  return apiKey;
}

export async function validateKey(providedKey: string): Promise<KeyValidationResult> {
  if (!providedKey) {
    return { valid: false, error: 'API key tidak valid' };
  }

  // Check legacy env-based keys first
  const legacyKeys = getLegacyKeys();
  if (legacyKeys.includes(providedKey)) {
    return {
      valid: true,
      key: {
        id: 'legacy',
        key: providedKey,
        name: 'Legacy Key',
        tier: 'pro' as TierName,
        rateLimit: -1,
        dailyLimit: -1,
        active: true,
        createdAt: new Date().toISOString(),
      },
    };
  }

  // Check stored keys — iterate all for constant-time-like behavior
  const store = await readKeysStore();
  let found: ApiKey | undefined;
  for (const k of store.keys) {
    if (k.key === providedKey) {
      found = k;
    }
  }

  // Key not found -> generic error
  if (!found) {
    return { valid: false, error: 'API key tidak valid' };
  }

  // Key inactive -> same generic error (no distinction per Req 12.6)
  if (!found.active) {
    return { valid: false, error: 'API key tidak valid' };
  }

  // Check expiry (Req 12.4)
  if (found.expiresAt) {
    const expiryDate = new Date(found.expiresAt);
    if (expiryDate.getTime() <= Date.now()) {
      return { valid: false, error: 'API key telah kedaluwarsa' };
    }
  }

  // Update lastUsed
  found.lastUsed = new Date().toISOString();
  await writeKeysStore(store);

  return { valid: true, key: found };
}

export async function checkRateLimit(apiKey: ApiKey): Promise<RateCheckResult> {
  const now = Date.now();
  const midnightReset = getMidnightResetWib();
  const dailyResetAt = Math.floor(midnightReset / 1000);

  // Per-minute rate limit
  let remaining = apiKey.rateLimit === -1 ? -1 : apiKey.rateLimit;
  let resetAt = Math.floor((now + RATE_WINDOW_MS) / 1000);

  if (apiKey.rateLimit !== -1) {
    const window = rateWindows.get(apiKey.id);
    if (!window || now - window.windowStart >= RATE_WINDOW_MS) {
      rateWindows.set(apiKey.id, { count: 1, windowStart: now });
      remaining = apiKey.rateLimit - 1;
    } else {
      window.count++;
      remaining = Math.max(0, apiKey.rateLimit - window.count);
      resetAt = Math.floor((window.windowStart + RATE_WINDOW_MS) / 1000);

      if (window.count > apiKey.rateLimit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          dailyRemaining: -1,
          dailyResetAt,
          error: `Rate limit terlampaui. Batas: ${apiKey.rateLimit}/menit. Coba lagi setelah reset.`,
        };
      }
    }
  }

  // Daily limit
  let dailyRemaining = apiKey.dailyLimit === -1 ? -1 : apiKey.dailyLimit;

  if (apiKey.dailyLimit !== -1) {
    const usage = await readDailyUsage();
    const today = getTodayWib();

    if (usage.date !== today) {
      usage.date = today;
      usage.counts = {};
    }

    const currentCount = (usage.counts[apiKey.id] || 0) + 1;
    usage.counts[apiKey.id] = currentCount;
    dailyRemaining = Math.max(0, apiKey.dailyLimit - currentCount);

    if (currentCount > apiKey.dailyLimit) {
      await writeDailyUsage(usage);
      return {
        allowed: false,
        remaining,
        resetAt,
        dailyRemaining: 0,
        dailyResetAt,
        error: `Batas harian terlampaui (${apiKey.dailyLimit}/hari). Reset tengah malam WIB.`,
      };
    }

    await writeDailyUsage(usage);
  }

  return { allowed: true, remaining, resetAt, dailyRemaining, dailyResetAt };
}

export async function listKeys(): Promise<Array<Omit<ApiKey, 'key'> & { key: string }>> {
  const store = await readKeysStore();
  return store.keys.map((k) => ({ ...k, key: maskKey(k.key) }));
}

export async function getKey(id: string): Promise<(Omit<ApiKey, 'key'> & { key: string }) | null> {
  const store = await readKeysStore();
  const found = store.keys.find((k) => k.id === id);
  if (!found) return null;
  return { ...found, key: maskKey(found.key) };
}

export async function updateKey(
  id: string,
  updates: Record<string, unknown>,
): Promise<(Omit<ApiKey, 'key'> & { key: string }) | null> {
  const store = await readKeysStore();
  const idx = store.keys.findIndex((k) => k.id === id);
  if (idx === -1) return null;

  const existing = store.keys[idx]!;
  if (updates.name !== undefined) existing.name = updates.name as string;
  if (updates.tier !== undefined && isValidTier(updates.tier as string)) {
    existing.tier = updates.tier as TierName;
    const tc = TIERS[existing.tier] as { rateLimit: number; dailyLimit: number };
    if (updates.rateLimit === undefined) existing.rateLimit = tc.rateLimit;
    if (updates.dailyLimit === undefined) existing.dailyLimit = tc.dailyLimit;
  }
  if (updates.active !== undefined) existing.active = updates.active as boolean;
  if (updates.rateLimit !== undefined) existing.rateLimit = updates.rateLimit as number;
  if (updates.dailyLimit !== undefined) existing.dailyLimit = updates.dailyLimit as number;
  if (updates.email !== undefined) existing.email = updates.email as string;
  if (updates.expiresAt !== undefined) existing.expiresAt = updates.expiresAt as string;

  store.keys[idx] = existing;
  await writeKeysStore(store);

  return { ...existing, key: maskKey(existing.key) };
}

export async function deleteKey(id: string): Promise<boolean> {
  const store = await readKeysStore();
  const idx = store.keys.findIndex((k) => k.id === id);
  if (idx === -1) return false;

  store.keys.splice(idx, 1);
  await writeKeysStore(store);
  return true;
}

export async function getStats(): Promise<{
  totalKeys: number;
  activeKeys: number;
  keysByTier: Record<string, number>;
  totalRequestsToday: number;
  topConsumers: Array<{ id: string; name: string; count: number }>;
}> {
  const store = await readKeysStore();
  const usage = await readDailyUsage();
  const today = getTodayWib();

  const keysByTier: Record<string, number> = {};
  for (const k of store.keys) {
    keysByTier[k.tier] = (keysByTier[k.tier] || 0) + 1;
  }

  const counts = usage.date === today ? usage.counts : {};
  const totalRequestsToday = Object.values(counts).reduce((a, b) => a + b, 0);

  const topConsumers = store.keys
    .map((k) => ({ id: k.id, name: k.name, count: counts[k.id] || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalKeys: store.keys.length,
    activeKeys: store.keys.filter((k) => k.active).length,
    keysByTier,
    totalRequestsToday,
    topConsumers,
  };
}
