export type LeadStatus = "new" | "contacted" | "replied" | "won" | "lost";
export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "replied", "won", "lost"];

/** A business as returned by search (not yet saved). */
export interface Business {
  osmId: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  lat: number | null;
  lon: number | null;
}

/** What we learned from looking at a business's website. */
export interface Signals {
  checkedAt: string;
  hasWebsite: boolean;
  reachable: boolean;
  https: boolean;
  mobileFriendly: boolean;
  title: string | null;
  description: string | null;
  emails: string[];
  phones: string[];
  socials: Record<string, string>;
  builder: string | null;
  loadMs: number | null;
  error: string | null;
}

export type Tier = "hot" | "warm" | "cold";

export interface ScoreResult {
  score: number;
  tier: Tier;
  reasons: string[];
}

export interface EnrichedBusiness extends Business {
  signals?: Signals;
  score?: number;
  tier?: Tier;
  reasons?: string[];
}
