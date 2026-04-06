// Tier definitions for API key management

export interface TierConfig {
  rateLimit: number;      // requests per minute (-1 = unlimited)
  dailyLimit: number;     // requests per day (-1 = unlimited)
  price: string;          // display price
  custom: boolean;        // advanced = custom limits per key
}

export const TIERS: Record<string, TierConfig> = {
  free:     { rateLimit: 30,    dailyLimit: 500,     price: 'Gratis',       custom: false },
  basic:    { rateLimit: 60,    dailyLimit: 5_000,   price: 'Rp 99K/bln',  custom: false },
  pro:      { rateLimit: -1,    dailyLimit: -1,      price: 'Rp 299K/bln', custom: false },
  advanced: { rateLimit: -1,    dailyLimit: -1,      price: 'Custom',      custom: true },
} as const;

export type TierName = 'free' | 'basic' | 'pro' | 'advanced';

export function getTier(name: string): TierConfig | undefined {
  return TIERS[name];
}

export function isValidTier(name: string): name is TierName {
  return name in TIERS;
}
