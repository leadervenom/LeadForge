import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, leads } from "@/lib/db";
import { enrichWebsite } from "@/lib/enrich";
import { limited } from "@/lib/rate-limit";
import { scoreLead } from "@/lib/score";
import { businessSchema, parseBody } from "@/lib/validation";

export const maxDuration = 30;

const bodySchema = z.object({
  business: businessSchema,
  /** When set, the saved lead is updated with the new signals and score. */
  leadId: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  const tooMany = limited(req, "enrich", 150);
  if (tooMany) return tooMany;

  const parsed = await parseBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { business, leadId } = parsed.data;

  const signals = await enrichWebsite(business.website);
  const result = scoreLead(business, signals);
  const email = business.email ?? signals.emails[0] ?? null;
  const phone = business.phone ?? signals.phones[0] ?? null;

  if (leadId) {
    await db()
      .update(leads)
      .set({ signals, score: result.score, email, phone, updatedAt: sql`now()` })
      .where(eq(leads.id, leadId));
  }

  return Response.json({ signals, email, phone, ...result });
}
