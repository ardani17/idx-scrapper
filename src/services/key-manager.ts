// Key Manager — storage, generation, validation, daily usage, rate limiting

import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { TIERS, type TierName, isValidTier } from './tier-config.ts';

// ── Types ───────────────────────────────────────

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  tier: TierName;
  email?: string;
  rateLimit: number;      // effective per-key limit (-1 = unlimited)
  dailyLimit: number;     // effective per-key limit (-1 = unlimited)
  active: boolean;
  createdAt: string;
  expiresAt?: string;
  lastUsed?: string;
}

interface KeysStore {
  keys: ApiKey[];
}

interface DailyUsage {
  date: string;        // YYYY-MM-DD in WIB
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
  resetAt: number;       // unix seconds
  dailyRemaining: number;
  dailyResetAt: number;  // unix seconds
  error?: string;
}

// ── Data directory ──────────────────────────────

const DATA_DIR = join(import.meta.dir, '..', '..', 'data');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

// ── Keys storage ────────────────────────────────

function readKeysStore(): KeysStore {
  ensureDataDir();
  const path = join(DATA_DIR, 'api-keys.json');
  if (!existsSync(path)) return { keys: [] };
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return { keys: [] };
  }
}

function writeKeysStore(store: KeysStore): void {
  ensureDataDir();
  writeFileSync(join(DATA_DIR, 'api-keys.json'), JSON.stringify(store, null, 2), 'utf-8');
}

// ── Daily usage storage ─────────────────────────

function readDailyUsage(): DailyUsage {
  ensureDataDir();
  const path = join(DATA_DIR, 'daily-usage.json');
  if (!existsSync(path)) return { date: getTodayWib(), counts: {} };
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return { date: getTodayWib(), counts: {} };
  }
}

function writeDailyUsage(usage: DailyUsage): void {
  ensureDataDir();
  writeFileSync(join(DATA_DIR, 'daily-usage.json'), JSON.stringify(usage, null, 2), 'utf-8');
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

// Cleanup stale entries every 5 min
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
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function generateId(): string {
  return randomHex(12);
}

// ── Legacy API_KEYS support ─────────────────────

function getLegacyKeys(): string[] {
  const env = process.env.API_KEYS;
  if (!env) return [];
  return env.split(',').map(k => k.trim()).filter(Boolean);
}

// ── Mask key for display ────────────────────────

export function maskKey(key: string): string {
  if (key.length <= 20) return key.slice(0, 8) + '...' + key.slice(-4);
  return key.slice(0, 10) + '...' + key.slice(-4);
}

// ═══════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════

/**
 * Generate a new API key.
 */
export function generateKey(opts: {
  name: string;
  tier: TierName;
  email?: string;
  rateLimit?: number;
  dailyLimit?: number;
}): ApiKey {
  const id = generateId();
  const key = `idsk_live_${randomHex(32)}`;
  const tierDef = TIERS[opts.tier];
  if (!tierDef) throw new Error(`Unknown tier: ${opts.tier}`);

  let rl = tierDef.rateLimit;
  let dl = tierDef.dailyLimit;

  if (tierDef.custom) {
    // Advanced tier: use custom limits, 0 or null → -1 (unlimited)
    rl = (opts.rateLimit && opts.rateLimit > 0) ? opts.rateLimit : -1;
    dl = (opts.dailyLimit && opts.dailyLimit > 0) ? opts.dailyLimit : -1;
  }

  const apiKey: ApiKey = {
    id,
    key,
    name: opts.name,
    tier: opts.tier,
    email: opts.email,
    rateLimit: rl,
    dailyLimit: dl,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const store = readKeysStore();
  store.keys.push(apiKey);
  writeKeysStore(store);

  return apiKey;
}

/**
 * List all keys (masked).
 */
export function listKeys(): (Omit<ApiKey, 'key' | 'email' | 'rateLimit' | 'dailyLimit'> & { keyPrefix: string; dailyUsage: number })[] {
  const store = readKeysStore();
  const usage = readDailyUsage();

  return store.keys.map(k => ({
    id: k.id,
    keyPrefix: maskKey(k.key),
    name: k.name,
    tier: k.tier,
    dailyUsage: usage.counts[k.id] || 0,
    lastUsed: k.lastUsed,
    createdAt: k.createdAt,
    active: k.active,
  }));
}

/**
 * Get single key detail.
 */
export function getKey(id: string): (ApiKey & { keyPrefix: string; dailyUsage: number }) | null {
  const store = readKeysStore();
  const usage = readDailyUsage();
  const found = store.keys.find(k => k.id === id);
  if (!found) return null;
  return { ...found, keyPrefix: maskKey(found.key), dailyUsage: usage.counts[found.id] || 0 };
}

/**
 * Update a key (tier, name, active, and optionally rateLimit/dailyLimit for advanced).
 */
export function updateKey(id: string, updates: Partial<Pick<ApiKey, 'name' | 'tier' | 'active' | 'rateLimit' | 'dailyLimit'>>): ApiKey | null {
  const store = readKeysStore();
  const found = store.keys.find(k => k.id === id);
  if (!found) return null;

  if (updates.name !== undefined) found.name = updates.name;
  if (updates.active !== undefined) found.active = updates.active;

  if (updates.tier && isValidTier(updates.tier)) {
    found.tier = updates.tier;
    const tierDef = TIERS[updates.tier];
    if (!tierDef) throw new Error(`Unknown tier: ${updates.tier}`);

    if (tierDef.custom) {
      // Advanced: apply custom limits if provided
      if (updates.rateLimit !== undefined && updates.rateLimit > 0) {
        found.rateLimit = updates.rateLimit;
      } else {
        found.rateLimit = -1;
      }
      if (updates.dailyLimit !== undefined && updates.dailyLimit > 0) {
        found.dailyLimit = updates.dailyLimit;
      } else {
        found.dailyLimit = -1;
      }
    } else {
      found.rateLimit = tierDef.rateLimit;
      found.dailyLimit = tierDef.dailyLimit;
    }
  }

  // Allow updating limits directly for advanced tier keys
  if (found.tier === 'advanced') {
    if (updates.rateLimit !== undefined) {
      found.rateLimit = (updates.rateLimit > 0) ? updates.rateLimit : -1;
    }
    if (updates.dailyLimit !== undefined) {
      found.dailyLimit = (updates.dailyLimit > 0) ? updates.dailyLimit : -1;
    }
  }

  writeKeysStore(store);
  return found;
}

/**
 * Delete (revoke) a key.
 */
export function deleteKey(id: string): boolean {
  const store = readKeysStore();
  const idx = store.keys.findIndex(k => k.id === id);
  if (idx === -1) return false;
  store.keys.splice(idx, 1);
  writeKeysStore(store);
  return true;
}

/**
 * Get usage statistics.
 */
export function getStats(): {
  totalKeys: number;
  keysPerTier: Record<string, number>;
  totalRequestsToday: number;
  topConsumers: { id: string; name: string; tier: string; count: number }[];
} {
  const store = readKeysStore();
  const usage = readDailyUsage();

  const keysPerTier: Record<string, number> = {};
  for (const k of store.keys) {
    keysPerTier[k.tier] = (keysPerTier[k.tier] || 0) + 1;
  }

  let totalRequestsToday = 0;
  const consumers: { id: string; name: string; tier: string; count: number }[] = [];

  for (const k of store.keys) {
    const count = usage.counts[k.id] || 0;
    totalRequestsToday += count;
    if (count > 0) {
      consumers.push({ id: k.id, name: k.name, tier: k.tier, count });
    }
  }

  consumers.sort((a, b) => b.count - a.count);

  return {
    totalKeys: store.keys.length,
    keysPerTier,
    totalRequestsToday,
    topConsumers: consumers.slice(0, 10),
  };
}

/**
 * Validate an API key and check rate + daily limits.
 * Does NOT increment counters — use checkRateLimit() after this.
 */
export function validateKey(providedKey: string): KeyValidationResult {
  if (!providedKey) {
    return { valid: false, error: 'Missing X-API-Key header' };
  }

  // 1. Check legacy keys (treated as pro)
  const legacy = getLegacyKeys();
  if (legacy.includes(providedKey)) {
    // Return a virtual pro key
    return {
      valid: true,
      key: {
        id: 'legacy',
        key: providedKey,
        name: 'Legacy Key',
        tier: 'pro',
        rateLimit: -1,
        dailyLimit: -1,
        active: true,
        createdAt: new Date(0).toISOString(),
      },
    };
  }

  // 2. Look up in api-keys.json
  const store = readKeysStore();
  const found = store.keys.find(k => k.key === providedKey);
  if (!found) {
    return { valid: false, error: 'Invalid API key' };
  }
  if (!found.active) {
    return { valid: false, error: 'API key is deactivated' };
  }

  return { valid: true, key: found };
}

/**
 * Check and increment rate + daily limits for a key.
 * Must be called AFTER validateKey() succeeds.
 */
export function checkRateLimit(keyData: ApiKey): RateCheckResult {
  const now = Date.now();
  const resetAtSec = Math.ceil((now + RATE_WINDOW_MS) / 1000);
  const dailyResetAtSec = Math.ceil(getMidnightResetWib() / 1000);

  // ── Per-minute rate limiting ──
  let remaining = 0;
  const rl = keyData.rateLimit;
  if (rl === -1) {
    // Unlimited
    remaining = -1;
  } else {
    let window = rateWindows.get(keyData.id);
    if (!window || (now - window.windowStart) >= RATE_WINDOW_MS) {
      window = { count: 0, windowStart: now };
      rateWindows.set(keyData.id, window);
    }
    window.count++;
    remaining = Math.max(0, rl - window.count);

    if (window.count > rl) {
      const retrySec = Math.ceil((window.windowStart + RATE_WINDOW_MS - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: resetAtSec,
        dailyRemaining: getDailyRemaining(keyData),
        dailyResetAt: dailyResetAtSec,
        error: `Rate limit exceeded. Try again in ${retrySec} seconds.`,
      };
    }
  }

  // ── Daily limit checking ──
  const dl = keyData.dailyLimit;
  if (dl !== -1) {
    const usage = ensureDailyUsageToday();
    const currentCount = usage.counts[keyData.id] || 0;

    if (currentCount >= dl) {
      return {
        allowed: false,
        remaining,
        resetAt: resetAtSec,
        dailyRemaining: 0,
        dailyResetAt: dailyResetAtSec,
        error: 'Daily limit exceeded. Upgrade your plan or contact support.',
      };
    }
  }

  // Increment daily usage
  incrementDailyUsage(keyData.id);

  // Update lastUsed
  touchLastUsed(keyData.id);

  return {
    allowed: true,
    remaining,
    resetAt: resetAtSec,
    dailyRemaining: getDailyRemaining(keyData),
    dailyResetAt: dailyResetAtSec,
  };
}

// ── Internal helpers ────────────────────────────

function ensureDailyUsageToday(): DailyUsage {
  const today = getTodayWib();
  let usage = readDailyUsage();
  if (usage.date !== today) {
    usage = { date: today, counts: {} };
    writeDailyUsage(usage);
  }
  return usage;
}

function incrementDailyUsage(keyId: string): void {
  const usage = ensureDailyUsageToday();
  usage.counts[keyId] = (usage.counts[keyId] || 0) + 1;
  writeDailyUsage(usage);
}

function getDailyRemaining(keyData: ApiKey): number {
  if (keyData.dailyLimit === -1) return -1; // unlimited
  const today = getTodayWib();
  let usage = readDailyUsage();
  if (usage.date !== today) return keyData.dailyLimit;
  return Math.max(0, keyData.dailyLimit - (usage.counts[keyData.id] || 0));
}

function touchLastUsed(keyId: string): void {
  if (keyId === 'legacy') return; // don't persist
  const store = readKeysStore();
  const found = store.keys.find(k => k.id === keyId);
  if (found) {
    found.lastUsed = new Date().toISOString();
    writeKeysStore(store);
  }
}
