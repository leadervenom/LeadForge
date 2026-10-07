import type { Business, ScoreResult, Signals, Tier } from "@/lib/types";

/**
 * Opportunity + reachability scoring, 0–100.
 * A high score means "this business visibly needs help, and you can reach them".
 */
export function scoreLead(b: Business, s?: Signals | null): ScoreResult {
  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  const emails = [b.email, ...(s?.emails ?? [])].filter(Boolean);
  const phones = [b.phone, ...(s?.phones ?? [])].filter(Boolean);

  // Opportunity
  if (!b.website) {
    add(45, "No website listed");
  } else if (s) {
    if (!s.reachable) add(35, "Website is down or unreachable");
    else {
      if (!s.https) add(20, "No HTTPS");
      if (!s.mobileFriendly) add(15, "Not mobile friendly");
      if (!s.description) add(5, "Missing meta description");
      if (!s.title) add(5, "Missing page title");
      if (s.loadMs !== null && s.loadMs > 3000) add(10, `Slow homepage (${(s.loadMs / 1000).toFixed(1)}s)`);
      if (s.builder && /wix|weebly|godaddy/i.test(s.builder)) add(5, `Built with ${s.builder}`);
      if (Object.keys(s.socials).length === 0) add(5, "No social profiles linked");
    }
  }

  // Reachability
  if (emails.length) add(15, "Email found");
  if (phones.length) add(10, "Phone listed");
  if (!emails.length && !phones.length) {
    // A lead you can't reach isn't much of a lead, however big the opportunity
    score -= 25;
    reasons.push("No direct contact found");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, tier: tierOf(score), reasons };
}

export function tierOf(score: number): Tier {
  if (score >= 55) return "hot";
  if (score >= 30) return "warm";
  return "cold";
}
