# LeadForge

**Type "dentists in Austin, TX" and get real local businesses you can contact, ranked by how much they need you, with a first email drafted for each.**

LeadForge is for freelancers and small agencies (web design, SEO, marketing, IT) who sell to local businesses and today copy and paste from Google Maps by hand.

Most lead tools sell stale contact lists. LeadForge pulls current listings and checks each business's website, so you see the opportunity as well as the contact: *no website*, *no HTTPS*, *not mobile friendly*, *no email on the site*. That's your pitch.

## Features

- **Search**: any type of business plus any place. Listings come from OpenStreetMap (Nominatim to geocode, Overpass for businesses). It's free and needs no API keys.
- **Website check**: fetches each homepage server-side and finds emails (falling back to the contact page), phones, social links, HTTPS, the mobile viewport, title and meta description, load time, and the site builder (WordPress, Wix, Squarespace…).
- **Score 0–100**: opportunity (no site +45, site down +35, no HTTPS +20, not mobile +15, slow +10, …) plus reachability (email +15, phone +10, no contact −25). Shown as **Hot / Warm / Cold**.
- **AI outreach**: one click drafts a short email that names the business's actual problems, using the AI SDK through Vercel AI Gateway (`anthropic/claude-sonnet-5-5`).
- **Pipeline**: save leads into lists and move them through New → Contacted → Replied → Won/Lost, with notes. Export to CSV.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Neon Postgres + Drizzle ORM · AI SDK + Vercel AI Gateway · cheerio · deployed on Vercel.

```
app/
  page.tsx                landing + search
  search/                 results, website checks, save, email drafts
  leads/                  pipeline: status, lists, notes, CSV export
  api/search              geocode + Overpass → normalized, scored businesses
  api/enrich              website check + score (SSRF-guarded fetch)
  api/outreach            AI email draft
  api/leads, api/lists    CRUD
  api/export              CSV
lib/
  osm.ts                  Nominatim + Overpass client, niche → OSM tag map
  enrich.ts               safe fetch + cheerio extraction
  score.ts                scoring rules
  db/                     Drizzle schema (lists, leads) + Neon client
```

## Run it locally

```bash
npm install
cp .env.example .env.local      # then fill in DATABASE_URL
npx drizzle-kit push            # create the tables
npm run dev
```

The AI email drafts need AI Gateway credentials. On a linked Vercel project, `vercel env pull .env.local` gives you a `VERCEL_OIDC_TOKEN`. Or set `AI_GATEWAY_API_KEY` yourself.

| Variable | Needed for |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string (pooled) |
| `VERCEL_OIDC_TOKEN` or `AI_GATEWAY_API_KEY` | AI email drafts (automatic on Vercel) |

## Notes

- There's no auth in v1. It's a single-user workspace. The search, enrich and AI routes have per-IP rate limits.
- Business data © OpenStreetMap contributors, licensed under ODbL. Coverage varies by area, so check details before you reach out.
