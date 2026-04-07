// AdminGuard — Secure admin key validation with brute-force protection
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5

import { timingSafeEqual } from 'crypto';
import { logger } from '../utils/logger';

// ── Interfaces ──────────────────────────────────

export interface AdminValidationResult {
  valid: boolean;
  error?: string;
  statusCode?: number;
}

export interface BruteForceEntry {
  failures: number;
  firstFailureAt: number;  // timestamp ms
  blockedUntil: number;    // timestamp ms, 0 = not blocked
}

interface IAdminGuard {
  validate(request: Request): AdminValidationResult;
  isBlocked(ip: string): boolean;
  recordFailure(ip: string): void;
}

// ── Constants ───────────────────────────────────

const MIN_KEY_LENGTH = 32;
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 5 * 60 * 1000;   // 5 minutes
const BLOCK_DURATION_MS = 15 * 60 * 1000;  // 15 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ── Helpers ─────────────────────────────────────

/**
 * Constant-time string comparison using crypto.timingSafeEqual.
 * Returns true if and only if a === b.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  // If lengths differ, compare bufA against itself to keep constant time,
  // but always return false.
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

// ── AdminGuard Class ────────────────────────────

class AdminGuard implements IAdminGuard {
  private readonly adminKey: string;
  private readonly bruteForceMap = new Map<string, BruteForceEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(adminKey: string) {
    this.adminKey = adminKey;
    this.startCleanup();
  }

  /**
   * Validate an incoming request's admin key.
   * Returns a generic error for ALL failure types (blocked, missing, wrong key).
   */
  validate(request: Request): AdminValidationResult {
    const ip = this.extractIp(request);

    // Check brute-force block first
    if (this.isBlocked(ip)) {
      logger.warn('Admin request blocked (brute-force)', { ip });
      return { valid: false, error: 'Invalid admin key', statusCode: 401 };
    }

    const providedKey = request.headers.get('X-Admin-Key') ?? '';

    if (!providedKey || !constantTimeEqual(providedKey, this.adminKey)) {
      this.recordFailure(ip);
      logger.warn('Admin auth failed', { ip });
      return { valid: false, error: 'Invalid admin key', statusCode: 401 };
    }

    return { valid: true };
  }

  /**
   * Check whether an IP is currently blocked.
   */
  isBlocked(ip: string): boolean {
    const entry = this.bruteForceMap.get(ip);
    if (!entry) return false;

    if (entry.blockedUntil > 0 && Date.now() < entry.blockedUntil) {
      return true;
    }

    // Block expired — clean up
    if (entry.blockedUntil > 0 && Date.now() >= entry.blockedUntil) {
      this.bruteForceMap.delete(ip);
      return false;
    }

    return false;
  }

  /**
   * Record a failed authentication attempt for an IP.
   * Blocks the IP after MAX_FAILURES within FAILURE_WINDOW_MS.
   */
  recordFailure(ip: string): void {
    const now = Date.now();
    const entry = this.bruteForceMap.get(ip);

    if (!entry) {
      this.bruteForceMap.set(ip, {
        failures: 1,
        firstFailureAt: now,
        blockedUntil: 0,
      });
      return;
    }

    // If the failure window has expired, reset
    if (now - entry.firstFailureAt > FAILURE_WINDOW_MS) {
      entry.failures = 1;
      entry.firstFailureAt = now;
      entry.blockedUntil = 0;
      return;
    }

    entry.failures += 1;

    if (entry.failures >= MAX_FAILURES) {
      entry.blockedUntil = now + BLOCK_DURATION_MS;
      logger.warn('IP blocked for brute-force', {
        ip,
        failures: entry.failures,
        blockedUntilMs: entry.blockedUntil,
      });
    }
  }

  /**
   * Extract client IP from request headers.
   */
  private extractIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0]!.trim();
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp;
    return 'unknown';
  }

  /**
   * Start periodic cleanup of expired brute-force entries.
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [ip, entry] of this.bruteForceMap) {
        const windowExpired = now - entry.firstFailureAt > FAILURE_WINDOW_MS;
        const blockExpired = entry.blockedUntil > 0 && now >= entry.blockedUntil;

        if (windowExpired || blockExpired) {
          this.bruteForceMap.delete(ip);
        }
      }
    }, CLEANUP_INTERVAL_MS);

    // Don't keep the process alive just for cleanup
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      (this.cleanupTimer as NodeJS.Timeout).unref();
    }
  }

  /**
   * Stop the cleanup interval (for graceful shutdown / testing).
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// ── Startup Validation ──────────────────────────

/**
 * Validate that ADMIN_API_KEY is set and meets minimum length.
 * Call this at application startup — throws if invalid.
 */
export function validateAdminKey(): string {
  const key = process.env.ADMIN_API_KEY;

  if (!key) {
    const msg = 'ADMIN_API_KEY environment variable is required but not set. Server cannot start.';
    logger.error(msg);
    throw new Error(msg);
  }

  if (key.length < MIN_KEY_LENGTH) {
    const msg = `ADMIN_API_KEY must be at least ${MIN_KEY_LENGTH} characters (got ${key.length}). Server cannot start.`;
    logger.error(msg);
    throw new Error(msg);
  }

  logger.info('Admin key validated', { keyLength: key.length });
  return key;
}

// ── Singleton Export ────────────────────────────

// Lazy singleton — created on first access or via createAdminGuard()
let _instance: AdminGuard | null = null;

/**
 * Create (or recreate) the AdminGuard singleton with the given key.
 * Typically called after validateAdminKey() succeeds.
 */
export function createAdminGuard(adminKey: string): AdminGuard {
  if (_instance) {
    _instance.destroy();
  }
  _instance = new AdminGuard(adminKey);
  return _instance;
}

/**
 * Get the current AdminGuard singleton.
 * Throws if createAdminGuard() has not been called yet.
 */
export function getAdminGuard(): AdminGuard {
  if (!_instance) {
    throw new Error('AdminGuard not initialized. Call createAdminGuard() first.');
  }
  return _instance;
}

// Convenience: export the class for testing
export { AdminGuard };
