import Link from "next/link";
import { ScoreBadge, SignalChips } from "@/components/lead-bits";
import { SearchBox } from "@/components/search-box";
import type { Signals } from "@/lib/types";

const EXAMPLES = [
  { niche: "Dentists", location: "Austin, TX" },
  { niche: "Plumbers", location: "Denver, CO" },
  { niche: "Hair salons", location: "Brooklyn, NY" },
  { niche: "Auto repair", location: "Portland, OR" },
];

const sample = (s: Partial<Signals>): Signals => ({
  checkedAt: "",
  hasWebsite: true,
  reachable: true,
  https: true,
  mobileFriendly: true,
  title: "x",
  description: "x",
  emails: ["x"],
  phones: [],
  socials: {},
  builder: null,
  loadMs: 900,
  error: null,
  ...s,
});

const SAMPLE_ROWS = [
  { name: "Riverside Family Dental", meta: "dentist · 2.1 km", score: 80, website: "http://riverside.example", signals: sample({ https: false, mobileFriendly: false, description: null }) },
  { name: "Oak Hill Smiles", meta: "dentist · 4.8 km", score: 55, website: null, signals: null },
  { name: "Capital Orthodontics", meta: "dentist · 6.0 km", score: 25, website: "https://cap.example", signals: sample({ builder: "WordPress" }) },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="grid-paper pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="relative mx-auto max-w-5xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
          <p className="animate-rise font-data text-xs font-medium uppercase tracking-[0.18em] text-forge">
            Lead generation for people who sell to local businesses
          </p>
          <h1 className="animate-rise mt-4 max-w-3xl text-4xl font-extrabold leading-[1.02] [animation-delay:60ms] sm:text-6xl">
            Find local businesses that need you, and the reason why.
          </h1>
          <p className="animate-rise mt-5 max-w-xl text-base leading-relaxed text-muted-foreground [animation-delay:120ms] sm:text-lg">
            LeadForge pulls current listings from OpenStreetMap and checks each website for problems you can fix:
            no site, no HTTPS, not mobile friendly, no way to email them. Then it drafts a first email that is about them,
            not you.
          </p>
          <div className="animate-rise mt-8 max-w-3xl [animation-delay:180ms]">
            <SearchBox size="lg" />
            <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-muted-foreground">
              <span className="mr-1">Try</span>
              {EXAMPLES.map((ex) => (
                <Link
                  key={ex.niche}
                  href={`/search?${new URLSearchParams({ niche: ex.niche, location: ex.location })}`}
                  className="inline-flex min-h-9 items-center rounded-md px-2 underline decoration-border underline-offset-4 transition hover:text-foreground hover:decoration-forge"
                >
                  {ex.niche.toLowerCase()} in {ex.location}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1.3fr] md:py-20">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">The opportunity, not just the contact.</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Most lead lists are stale names and numbers. LeadForge scores each business from 0 to 100 on how clearly it
            needs help and whether you can actually reach it. Orange means there&apos;s something to pitch.
          </p>
          <ol className="mt-8 grid gap-5">
            {[
              ["Search", "Pick a type of business and a place. Results come back in seconds, with no API keys and no sign-up."],
              ["Check", "One click checks every website: HTTPS, mobile, email on the page, speed, which site builder."],
              ["Reach out", "Draft a short, specific email for any lead, save it to your pipeline, and export to CSV."],
            ].map(([title, body], i) => (
              <li key={title} className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="font-data text-sm font-semibold text-forge">0{i + 1}</span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <figure className="self-start overflow-hidden rounded-xl border bg-card" aria-label="Example results">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="font-data text-xs text-muted-foreground">dentists · austin, tx</span>
            <span className="font-data text-xs text-muted-foreground">example</span>
          </div>
          <ul className="divide-y">
            {SAMPLE_ROWS.map((r) => (
              <li key={r.name} className="grid grid-cols-[4.5rem_1fr] items-start gap-4 px-4 py-4">
                <ScoreBadge score={r.score} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="font-data text-xs text-muted-foreground">{r.meta}</p>
                  <div className="mt-2">
                    <SignalChips website={r.website} signals={r.signals} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </figure>
      </section>

      <footer className="mt-auto border-t">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <span>Business data © OpenStreetMap contributors (ODbL).</span>
          <span>LeadForge · built with Next.js, Neon and Vercel</span>
        </div>
      </footer>
    </>
  );
}
