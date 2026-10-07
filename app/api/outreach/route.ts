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

export async function POST(req: Request) {
  const tooMany = limited(req, "outreach", 15);
  if (tooMany) return tooMany;

  const parsed = await parseBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { business, signals, leadId, sender } = parsed.data;

  const { reasons } = scoreLead(business, signals ?? null);
  const findings = [
    `Business: ${business.name}`,
    business.category && `Category: ${business.category}`,
    business.address && `Address: ${business.address}`,
    business.website ? `Website: ${business.website}` : "Website: none listed",
    signals?.title && `Homepage title: ${signals.title}`,
    signals?.builder && `Site builder: ${signals.builder}`,
    `Findings: ${reasons.filter((r) => r !== "Email found" && r !== "Phone listed").join("; ") || "no obvious problems"}`,
    `Sender name: ${sender?.name || "(not given)"}`,
    `What the sender offers: ${sender?.offer || "website design, SEO and local marketing"}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text } = await generateText({
      model: MODEL,
      instructions: INSTRUCTIONS,
      prompt: findings,
      maxOutputTokens: 500,
    });

    const match = text.match(/^\s*Subject:\s*(.+)\n+([\s\S]+)$/i);
    const subject = match ? match[1].trim() : `Quick idea for ${business.name}`;
    const body = (match ? match[2] : text).trim();
    const outreach = `Subject: ${subject}\n\n${body}`;

    if (leadId) {
      await db().update(leads).set({ outreach, updatedAt: sql`now()` }).where(eq(leads.id, leadId));
    }
    return Response.json({ subject, body });
  } catch (err) {
    console.error("outreach failed", err);
    return Response.json(
      { error: "Couldn't draft the email right now. Check that AI Gateway is enabled for this project." },
      { status: 502 },
    );
  }
}
