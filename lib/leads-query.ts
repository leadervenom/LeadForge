import { and, desc, eq, type SQL } from "drizzle-orm";
import { db, leads } from "@/lib/db";
import { statusSchema } from "@/lib/validation";

/** Read ?status= and ?listId= filters and return matching leads, newest first. */
export async function findLeads(searchParams: URLSearchParams) {
  const where: SQL[] = [];
  const status = statusSchema.safeParse(searchParams.get("status"));
  if (status.success) where.push(eq(leads.status, status.data));
  const listId = Number(searchParams.get("listId"));
  if (Number.isInteger(listId) && listId > 0) where.push(eq(leads.listId, listId));

  return db()
    .select()
    .from(leads)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(leads.createdAt), desc(leads.id))
    .limit(2000);
}
