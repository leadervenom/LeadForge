"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookmarkCheckIcon,
  BookmarkPlusIcon,
  ExternalLinkIcon,
  MailIcon,
  PhoneIcon,
  PlusIcon,
  RadarIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { hostOf, ScoreBadge, SignalChips } from "@/components/lead-bits";
import { NewListDialog, type ListSummary } from "@/components/new-list-dialog";
import { OutreachDialog, type OutreachTarget } from "@/components/outreach-dialog";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, pool } from "@/lib/client";
import { tierOf } from "@/lib/score";
import type { Business, Signals, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Row extends Business {
  score: number;
  reasons: string[];
  signals?: Signals;
  enriching?: boolean;
  leadId?: number;
  distanceKm?: number;
}

interface SearchResponse {
  niche: string;
  location: string;
  matched: string | null;
  place: { lat: number; lon: number; displayName: string };
  results: (Business & { score: number; reasons: string[] })[];
}

type TierFilter = "all" | Tier;

function distanceKm(a: { lat: number; lon: number }, b: { lat: number | null; lon: number | null }) {
  if (b.lat === null || b.lon === null) return undefined;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toBusiness(r: Row): Business {
  return {
    osmId: r.osmId,
    name: r.name,
    category: r.category,
    address: r.address,
    phone: r.phone,
    website: r.website,
    email: r.email,
    lat: r.lat,
    lon: r.lon,
  };
}

export function Results() {
  const params = useSearchParams();
  const niche = params.get("niche") ?? "";
  const location = params.get("location") ?? "";
  // Remount per search so all result state starts fresh
  return <ResultsView key={`${niche}|${location}`} niche={niche} location={location} />;
}

function ResultsView({ niche, location }: { niche: string; location: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Pick<SearchResponse, "matched" | "place"> | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    niche && location ? "loading" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TierFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState<{ done: number; total: number } | null>(null);
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [listId, setListId] = useState<number | null>(null);
  const [newListOpen, setNewListOpen] = useState(false);
  const [outreach, setOutreach] = useState<OutreachTarget | null>(null);

  const patchRow = useCallback((osmId: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.osmId === osmId ? { ...r, ...patch } : r)));
  }, []);

  useEffect(() => {
    api<{ lists: ListSummary[] }>("/api/lists")
      .then((d) => setLists(d.lists))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!niche || !location) return;
    let cancelled = false;
    Promise.all([
      api<SearchResponse>("/api/search", { method: "POST", json: { niche, location } }),
      api<{ leads: { id: number; osmId: string }[] }>("/api/leads").catch(() => ({ leads: [] })),
    ])
      .then(([res, saved]) => {
        if (cancelled) return;
        const savedIds = new Map(saved.leads.map((l) => [l.osmId, l.id]));
        setMeta({ matched: res.matched, place: res.place });
        setRows(
          res.results.map((r) => ({
            ...r,
            leadId: savedIds.get(r.osmId),
            distanceKm: distanceKm(res.place, r),
          })),
        );
        setStatus("done");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [niche, location]);

  const visible = useMemo(() => {
    const list = filter === "all" ? rows : rows.filter((r) => tierOf(r.score) === filter);
    return [...list].sort((a, b) => b.score - a.score);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c = { all: rows.length, hot: 0, warm: 0, cold: 0 };
    for (const r of rows) c[tierOf(r.score)]++;
    return c;
  }, [rows]);

  const unchecked = rows.filter((r) => r.website && !r.signals);

  async function enrichOne(row: Row) {
    patchRow(row.osmId, { enriching: true });
    try {
      const res = await api<{ signals: Signals; score: number; reasons: string[]; email: string | null; phone: string | null }>(
        "/api/enrich",
        { method: "POST", json: { business: toBusiness(row), leadId: row.leadId } },
      );
      patchRow(row.osmId, {
        signals: res.signals,
        score: res.score,
        reasons: res.reasons,
        email: res.email,
        phone: res.phone,
        enriching: false,
      });
    } catch (err) {
      patchRow(row.osmId, { enriching: false });
      toast.error(`${row.name}: ${(err as Error).message}`);
    }
  }

  async function enrichAll() {
    const targets = unchecked;
    if (!targets.length) return;
    setChecking({ done: 0, total: targets.length });
    await pool(targets, 4, async (row) => {
      await enrichOne(row);
      setChecking((c) => (c ? { ...c, done: c.done + 1 } : c));
    });
    setChecking(null);
    toast.success(`Checked ${targets.length} websites`);
  }

  async function save(targets: Row[]) {
    if (!targets.length) return;
    try {
      const { saved } = await api<{ saved: { id: number; osmId: string }[] }>("/api/leads", {
        method: "POST",
        json: {
          listId,
          items: targets.map((r) => ({ business: toBusiness(r), signals: r.signals ?? null, score: r.score })),
        },
      });
      const ids = new Map(saved.map((s) => [s.osmId, s.id]));
      setRows((prev) => prev.map((r) => (ids.has(r.osmId) ? { ...r, leadId: ids.get(r.osmId) } : r)));
      setSelected(new Set());
      const listName = lists.find((l) => l.id === listId)?.name;
      toast.success(
        `Saved ${saved.length} lead${saved.length === 1 ? "" : "s"}${listName ? ` to ${listName}` : ""}`,
        { action: { label: "Open pipeline", onClick: () => router.push("/leads") } },
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function toggle(osmId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(osmId)) next.delete(osmId);
      else next.add(osmId);
      return next;
    });
  }

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.osmId));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <SearchBox defaultNiche={niche} defaultLocation={location} />

      {!niche || !location ? (
        <EmptyState title="Search for a type of business and a place." body="For example: dentists in Austin, TX." />
      ) : status === "loading" ? (
        <ResultsSkeleton inline />
      ) : status === "error" ? (
        <EmptyState title="That search didn't work." body={error ?? "Something went wrong."} />
      ) : status === "done" && rows.length === 0 ? (
        <EmptyState
          title={`No ${niche.toLowerCase()} found near ${location}.`}
          body={
            meta?.matched
              ? "OpenStreetMap has no listings for this area yet. Try a bigger nearby city."
              : "Try a more common term (e.g. 'dentist', 'plumber', 'cafe') or a bigger nearby city."
          }
        />
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">
                {rows.length} {niche.toLowerCase()} near {location}
              </h1>
              {meta?.place && (
                <p className="mt-1 line-clamp-1 font-data text-xs text-muted-foreground">
                  {meta.place.displayName} · within 10 km
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={enrichAll}
                disabled={!!checking || unchecked.length === 0}
                className="h-10 gap-2 bg-forge text-forge-foreground hover:bg-forge/90"
              >
                <RadarIcon className={cn(checking && "animate-spin")} />
                {checking
                  ? `Checking ${checking.done}/${checking.total}…`
                  : unchecked.length
                    ? `Check ${unchecked.length} websites`
                    : "All websites checked"}
              </Button>
            </div>
          </div>

          <div className="sticky top-14 z-30 -mx-4 mt-4 flex flex-wrap items-center gap-2 border-y bg-background/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
            <div role="tablist" aria-label="Filter by tier" className="flex rounded-lg border p-0.5">
              {(["all", "hot", "warm", "cold"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={filter === t}
                  onClick={() => setFilter(t)}
                  className={cn(
                    "h-9 rounded-md px-3 text-sm font-medium capitalize text-muted-foreground transition-colors",
                    filter === t && "bg-secondary text-foreground",
                  )}
                >
                  {t} <span className="font-data text-xs opacity-70">{counts[t]}</span>
                </button>
              ))}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="hidden sm:inline">Save to</span>
                <select
                  value={listId ?? ""}
                  onChange={(e) => setListId(e.target.value ? Number(e.target.value) : null)}
                  className="h-9 rounded-md border bg-card px-2 text-sm text-foreground"
                >
                  <option value="">No list</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="outline" size="icon" className="size-9" aria-label="New list" onClick={() => setNewListOpen(true)}>
                <PlusIcon />
              </Button>
              <Button
                variant="outline"
                className="h-9 gap-2"
                onClick={() => save(selected.size ? rows.filter((r) => selected.has(r.osmId)) : visible)}
              >
                <BookmarkPlusIcon />
                {selected.size ? `Save ${selected.size} selected` : `Save all ${visible.length}`}
              </Button>
            </div>
          </div>

          <div className="mt-2 hidden grid-cols-[2rem_5rem_minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_auto] gap-4 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground lg:grid">
            <input
              type="checkbox"
              aria-label="Select all visible"
              checked={allVisibleSelected}
              onChange={() =>
                setSelected(allVisibleSelected ? new Set() : new Set(visible.map((r) => r.osmId)))
              }
              className="size-4 accent-[var(--forge)]"
            />
            <span>Score</span>
            <span>Business</span>
            <span>Contact</span>
            <span>Website signals</span>
            <span className="w-[8.5rem] text-right">Actions</span>
          </div>

          <ul className="divide-y rounded-xl border bg-card lg:rounded-lg">
            {visible.map((r, i) => (
              <li
                key={r.osmId}
                style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                className={cn(
                  "animate-rise grid grid-cols-[auto_1fr] gap-x-3 gap-y-3 p-4 lg:grid-cols-[2rem_5rem_minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_auto] lg:items-center lg:gap-4 lg:px-3 lg:py-3",
                  selected.has(r.osmId) && "bg-forge/5",
                )}
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${r.name}`}
                  checked={selected.has(r.osmId)}
                  onChange={() => toggle(r.osmId)}
                  className="mt-1 size-5 accent-[var(--forge)] lg:mt-0 lg:size-4"
                />
                <div className="flex items-start justify-between gap-3 lg:contents">
                  <div className="order-2 lg:order-none">
                    <ScoreBadge score={r.score} pending={r.enriching} />
                  </div>
                  <div className="min-w-0 lg:order-none" title={r.reasons.join(" · ")}>
                    <p className="font-semibold leading-snug">
                      {r.name}
                      {r.leadId && (
                        <BookmarkCheckIcon className="ml-1.5 inline size-3.5 text-ok" aria-label="Saved" />
                      )}
                    </p>
                    <p className="mt-0.5 font-data text-xs text-muted-foreground">
                      {[r.category, r.distanceKm !== undefined && `${r.distanceKm.toFixed(1)} km`].filter(Boolean).join(" · ")}
                    </p>
                    {r.address && <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.address}</p>}
                  </div>
                </div>

                <div className="col-start-2 grid gap-1 text-sm lg:col-start-auto">
                  {r.phone && (
                    <a href={`tel:${r.phone}`} className="flex items-center gap-1.5 font-data text-xs hover:text-forge">
                      <PhoneIcon className="size-3 shrink-0 text-muted-foreground" />
                      {r.phone}
                    </a>
                  )}
                  {(r.email ?? r.signals?.emails[0]) && (
                    <a
                      href={`mailto:${r.email ?? r.signals?.emails[0]}`}
                      className="flex min-w-0 items-center gap-1.5 font-data text-xs hover:text-forge"
                    >
                      <MailIcon className="size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{r.email ?? r.signals?.emails[0]}</span>
                    </a>
                  )}
                  {r.website && (
                    <a
                      href={r.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-1.5 font-data text-xs text-muted-foreground hover:text-forge"
                    >
                      <ExternalLinkIcon className="size-3 shrink-0" />
                      <span className="truncate">{hostOf(r.website)}</span>
                    </a>
                  )}
                  {!r.phone && !r.email && !r.website && <span className="text-xs text-muted-foreground">No contact info</span>}
                </div>

                <div className="col-start-2 lg:col-start-auto">
                  <SignalChips website={r.website} signals={r.signals} />
                </div>

                <div className="col-start-2 flex flex-wrap gap-1.5 lg:col-start-auto lg:w-[8.5rem] lg:justify-end">
                  {r.website && !r.signals && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 lg:h-8"
                      onClick={() => enrichOne(r)}
                      disabled={r.enriching}
                    >
                      {r.enriching ? "Checking…" : "Check"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1 lg:h-8"
                    onClick={() => setOutreach({ business: toBusiness(r), signals: r.signals, leadId: r.leadId })}
                  >
                    <SparklesIcon /> Email
                  </Button>
                  {!r.leadId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 lg:size-8"
                      aria-label={`Save ${r.name}`}
                      onClick={() => save([r])}
                    >
                      <BookmarkPlusIcon />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {visible.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No {filter} leads in these results.</p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Listings © OpenStreetMap contributors. Data can be incomplete; check before you reach out.{" "}
            <Link href="/leads" className="underline underline-offset-4 hover:text-foreground">
              Open your pipeline →
            </Link>
          </p>
        </>
      )}

      <NewListDialog
        open={newListOpen}
        onOpenChange={setNewListOpen}
        onCreated={(l) => {
          setLists((prev) => [...prev, l].sort((a, b) => a.name.localeCompare(b.name)));
          setListId(l.id);
        }}
      />
      <OutreachDialog target={outreach} onClose={() => setOutreach(null)} />
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <div className="grid-paper mb-6 size-20 rounded-2xl border" />
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function ResultsSkeleton({ inline }: { inline?: boolean }) {
  return (
    <div className={cn(!inline && "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8")}>
      {!inline && <Skeleton className="h-16 w-full rounded-xl" />}
      <div className="mt-6">
        <Skeleton className="h-8 w-72" />
        <p className="mt-2 font-data text-xs text-muted-foreground">Searching OpenStreetMap…</p>
      </div>
      <div className="mt-6 divide-y rounded-xl border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-8 w-16" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="hidden h-6 w-40 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
