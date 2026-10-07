import { generateText } from "ai";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, leads } from "@/lib/db";
import { limited } from "@/lib/rate-limit";
import { scoreLead } from "@/lib/score";
import { businessSchema, parseBody, signalsSchema } from "@/lib/validation";

export const maxDuration = 60;

const MODEL = "anthropic/claude-sonnet-5-5";

const bodySchema = z.object({
  business: businessSchema,
  signals: signalsSchema.nullable().optional(),
  leadId: z.number().int().positive().optional(),
  sender: z
    .object({
      name: z.string().max(100).optional(),
      offer: z.string().max(300).optional(),
    })
    .optional(),
});

const INSTRUCTIONS = `You write first-touch cold emails for freelancers and small agencies who sell web, SEO, and marketing services to local businesses.

Rules:
- Under 120 words in the body. Plain text, no markdown, no emojis.
- Open with something specific to this business, not flattery.
- Mention at most two concrete problems from the findings, in plain language a busy owner understands. Never invent findings.
- One clear, low-friction ask (a 10-minute call or "want me to send a quick mockup?").
- Friendly and direct. No buzzwords, no "I hope this email finds you well".
- Sign off with the sender's name if given, otherwise "[Your name]".

Output format exactly:
Subject: <subject line, under 8 words>

<email body>`;

const NOT_PROBLEMS = new Set(["Email found", "Phone listed", "No direct contact found"]);

export async function POST(req: Request) {
  const tooMany = limited(req, "outreach", 15);
  if (tooMany) return tooMany;

  const parsed = await parseBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { business, signals, leadId, sender } = parsed.data;

  const problems = scoreLead(business, signals ?? null).reasons.filter((r) => !NOT_PROBLEMS.has(r));
  const findings = [
    `Business: ${business.name}`,
    business.category && `Category: ${business.category}`,
    business.address && `Address: ${business.address}`,
    business.website ? `Website: ${business.website}` : "Website: none listed",
    signals?.title && `Homepage title: ${signals.title}`,
    signals?.builder && `Site builder: ${signals.builder}`,
    `Findings: ${problems.join("; ") || "no obvious problems"}`,
    `Sender name: ${sender?.name || "(not given)"}`,
    `What the sender offers: ${sender?.offer || "website design, SEO and local marketing"}`,
  ]
    .filter(Boolean)
    .join("\n");

  let subject: string;
  let body: string;
  let source: "ai" | "template" = "ai";
  try {
    const { text } = await generateText({
      model: MODEL,
      instructions: INSTRUCTIONS,
      prompt: findings,
      maxOutputTokens: 500,
    });
    const match = text.match(/^\s*Subject:\s*(.+)\n+([\s\S]+)$/i);
    subject = match ? match[1].trim() : `Quick idea for ${business.name}`;
    body = (match ? match[2] : text).trim();
  } catch (err) {
    // AI Gateway unavailable (not enabled, no credits, outage): fall back to a plain template
    console.error("outreach AI failed, using template", err);
    ({ subject, body } = templateEmail(business.name, business.website, problems, sender));
    source = "template";
  }

  if (leadId) {
    await db()
      .update(leads)
      .set({ outreach: `Subject: ${subject}\n\n${body}`, updatedAt: sql`now()` })
      .where(eq(leads.id, leadId));
  }
  return Response.json({ subject, body, source });
}

const PLAIN: Record<string, string> = {
  "No website listed":
    "I couldn't find a website for you, so people searching on their phones may be finding a competitor first",
  "Website is down or unreachable": "your website didn't load when I tried it",
  "No HTTPS": 'your site doesn\'t use HTTPS, so some browsers warn visitors it is "Not secure"',
  "Not mobile friendly": "your site isn't set up for phones, where most local searches happen",
  "Missing meta description": "your site is missing the short description Google shows in search results",
  "Missing page title": "your homepage has no title for Google to show",
};

function templateEmail(
  name: string,
  website: string | null,
  problems: string[],
  sender?: { name?: string; offer?: string },
) {
  const points = problems
    .map((p) => PLAIN[p] ?? (p.startsWith("Slow homepage") ? "your homepage takes a while to load" : null))
    .filter((p): p is string => Boolean(p))
    .slice(0, 2);
  const looked = website ? "I was looking at your website" : `I was looking for ${name} online`;
  const finding = points.length
    ? ` and noticed ${points.join(", and ")}.`
    : ". It looks solid, but I had a couple of ideas that could bring in more customers.";
  const offer = sender?.offer?.trim() || "websites and local search for small businesses";
  const body = [
    `Hi ${name} team,`,
    "",
    `${looked}${finding}`,
    "",
    `I help with ${offer.charAt(0).toLowerCase() + offer.slice(1)}, and this is usually a quick fix. Would a 10-minute call this week be useful, or should I send over a short mockup first?`,
    "",
    "Thanks,",
    sender?.name?.trim() || "[Your name]",
  ].join("\n");
  return { subject: `Quick idea for ${name}`, body };
}
