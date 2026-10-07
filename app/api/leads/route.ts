import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, leads } from "@/lib/db";
import { findLeads } from "@/lib/leads-query";
import { limited } from "@/lib/rate-limit";
import { businessSchema, parseBody, signalsSchema, statusSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const rows = await findLeads(new URL(req.url).searchParams);
  return Response.json({ leads: rows });
}

const saveSchema = z.object({
  listId: z.number().int().positive().nullable().optional(),
  items: z
    .array(
      z.object({
        business: businessSchema,
        signals: signalsSchema.nullable().optional(),
        score: z.number().int().min(0).max(100).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});

/** Save (upsert by OSM id) one or more businesses as leads. */
export async function POST(req: Request) {
  const tooMany = limited(req, "leads-write", 60);
  if (tooMany) return tooMany;

  const parsed = await parseBody(req, saveSchema);
  if ("error" in parsed) return parsed.error;
  const { listId, items } = parsed.data;

  const values = items.map(({ business: b, signals, score }) => ({
    osmId: b.osmId,
    name: b.name,
    category: b.category,
    address: b.address,
    phone: b.phone ?? signals?.phones[0] ?? null,
    website: b.website,
    email: b.email ?? signals?.emails[0] ?? null,
    lat: b.lat,
    lon: b.lon,
    signals: signals ?? null,
    score: score ?? null,
    listId: listId ?? null,
  }));

  const saved = await db()
    .insert(leads)
    .values(values)
    .onConflictDoUpdate({
      target: leads.osmId,
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        address: sql`excluded.address`,
        phone: sql`coalesce(excluded.phone, ${leads.phone})`,
        website: sql`excluded.website`,
        email: sql`coalesce(excluded.email, ${leads.email})`,
        signals: sql`coalesce(excluded.signals, ${leads.signals})`,
        score: sql`coalesce(excluded.score, ${leads.score})`,
        listId: sql`coalesce(excluded.list_id, ${leads.listId})`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: leads.id, osmId: leads.osmId });

  return Response.json({ saved });
}

const patchSchema = z.object({
  id: z.number().int().positive(),
  status: statusSchema.optional(),
  notes: z.string().max(5000).nullable().optional(),
  listId: z.number().int().positive().nullable().optional(),
  outreach: z.string().max(5000).nullable().optional(),
});

export async function PATCH(req: Request) {
  const tooMany = limited(req, "leads-write", 60);
  if (tooMany) return tooMany;

  const parsed = await parseBody(req, patchSchema);
  if ("error" in parsed) return parsed.error;
  const { id, ...changes } = parsed.data;

  const [row] = await db()
    .update(leads)
    .set({ ...changes, updatedAt: sql`now()` })
    .where(eq(leads.id, id))
    .returning();
  if (!row) return Response.json({ error: "Lead not found" }, { status: 404 });
  return Response.json({ lead: row });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }
  await db().delete(leads).where(eq(leads.id, id));
  return Response.json({ ok: true });
}
