import { z } from "zod";
import { parseQuery, searchBusinesses } from "@/lib/osm";
import { limited } from "@/lib/rate-limit";
import { scoreLead } from "@/lib/score";
import { parseBody } from "@/lib/validation";

export const maxDuration = 60;

const bodySchema = z.object({
  query: z.string().max(200).optional(),
  niche: z.string().max(100).optional(),
  location: z.string().max(150).optional(),
  radiusKm: z.number().min(1).max(50).optional(),
});

export async function POST(req: Request) {
  const tooMany = limited(req, "search", 12);
  if (tooMany) return tooMany;

  const parsed = await parseBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  let niche = body.niche?.trim();
  let location = body.location?.trim();
  if ((!niche || !location) && body.query) {
    const q = parseQuery(body.query);
    if (q) {
      niche ||= q.niche;
      location ||= q.location;
    }
  }
  if (!niche || !location) {
    return Response.json(
      { error: 'Tell us what and where, e.g. "dentists in Austin, TX".' },
      { status: 400 },
    );
  }

  try {
    const { place, matched, businesses } = await searchBusinesses({
      niche,
      location,
      radiusKm: body.radiusKm,
    });
    if (!place) {
      return Response.json({ error: `Couldn't find a place called "${location}".` }, { status: 404 });
    }
    const results = businesses
      .map((b) => ({ ...b, ...scoreLead(b) }))
      .sort((a, b) => b.score - a.score);
    return Response.json({ niche, location, matched, place, results });
  } catch (err) {
    console.error("search failed", err);
    return Response.json(
      { error: "The map data service is busy right now. Try again in a few seconds." },
      { status: 502 },
    );
  }
}
