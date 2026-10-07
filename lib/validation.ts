import { z } from "zod";

export const businessSchema = z.object({
  osmId: z.string().min(1).max(64),
  name: z.string().min(1).max(300),
  category: z.string().max(100).nullable(),
  address: z.string().max(500).nullable(),
  phone: z.string().max(100).nullable(),
  website: z.string().max(2000).nullable(),
  email: z.string().max(320).nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
});

export const signalsSchema = z.object({
  checkedAt: z.string(),
  hasWebsite: z.boolean(),
  reachable: z.boolean(),
  https: z.boolean(),
  mobileFriendly: z.boolean(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  emails: z.array(z.string()),
  phones: z.array(z.string()),
  socials: z.record(z.string(), z.string()),
  builder: z.string().nullable(),
  loadMs: z.number().nullable(),
  error: z.string().nullable(),
});

export const statusSchema = z.enum(["new", "contacted", "replied", "won", "lost"]);

/** Parse a JSON body against a schema, returning either data or a 400 response. */
export async function parseBody<T extends z.ZodType>(req: Request, schema: T) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { error: Response.json({ error: "Invalid JSON body" }, { status: 400 }) } as const;
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      error: Response.json(
        { error: "Invalid request", issues: result.error.issues.slice(0, 5) },
        { status: 400 },
      ),
    } as const;
  }
  return { data: result.data as z.infer<T> } as const;
}
