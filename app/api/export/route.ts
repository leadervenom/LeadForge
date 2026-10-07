import { findLeads } from "@/lib/leads-query";
import { tierOf } from "@/lib/score";

const COLUMNS = [
  "name",
  "category",
  "status",
  "score",
  "tier",
  "email",
  "phone",
  "website",
  "address",
  "https",
  "mobile_friendly",
  "notes",
  "outreach",
  "osm_id",
] as const;

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Stop spreadsheet apps from treating cells as formulas, but leave phone numbers like "+1 512…" alone
  if (/^[=@\t\r]/.test(s) || /^[+-](?![\d\s().-]+$)/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const rows = await findLeads(new URL(req.url).searchParams);
  const lines = [COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.category,
        r.status,
        r.score,
        r.score === null ? "" : tierOf(r.score),
        r.email,
        r.phone,
        r.website,
        r.address,
        r.signals ? r.signals.https : "",
        r.signals ? r.signals.mobileFriendly : "",
        r.notes,
        r.outreach,
        r.osmId,
      ]
        .map(cell)
        .join(","),
    );
  }
  const date = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leadforge-${date}.csv"`,
    },
  });
}
