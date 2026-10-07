import { asc, count, eq } from "drizzle-orm";
import { connection } from "next/server";
import { z } from "zod";
import { db, leads, lists } from "@/lib/db";
import { limited } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validation";

export async function GET() {
  await connection();
  const rows = await db()
    .select({ id: lists.id, name: lists.name, createdAt: lists.createdAt, leadCount: count(leads.id) })
    .from(lists)
    .leftJoin(leads, eq(leads.listId, lists.id))
    .groupBy(lists.id)
    .orderBy(asc(lists.name));
  return Response.json({ lists: rows });
}

export async function POST(req: Request) {
  const tooMany = limited(req, "leads-write", 60);
  if (tooMany) return tooMany;

  const parsed = await parseBody(req, z.object({ name: z.string().trim().min(1).max(80) }));
  if ("error" in parsed) return parsed.error;

  const [row] = await db().insert(lists).values({ name: parsed.data.name }).returning();
  return Response.json({ list: row });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }
  await db().delete(lists).where(eq(lists.id, id));
  return Response.json({ ok: true });
}
