"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DownloadIcon,
  ExternalLinkIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  PlusIcon,
  RadarIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { hostOf, ScoreBadge, SignalChips } from "@/components/lead-bits";
import { NewListDialog, type ListSummary } from "@/components/new-list-dialog";
import { OutreachDialog, type OutreachTarget } from "@/components/outreach-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { LEAD_STATUSES, type Business, type LeadStatus, type Signals } from "@/lib/types";
import { cn, gmailComposeUrl, googleProfileUrl } from "@/lib/utils";

interface Lead extends Business {
  id: number;
  listId: number | null;
  signals: Signals | null;
  score: number | null;
  status: LeadStatus;
  notes: string | null;
  outreach: string | null;
  updatedAt: string;
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  won: "Won",
  lost: "Lost",
};

const STATUS_DOT: Record<LeadStatus, string> = {
  new: "bg-muted-foreground",
  contacted: "bg-warm",
  replied: "bg-forge",
  won: "bg-ok",
  lost: "bg-destructive/60",
};

function toBusiness(l: Lead): Business {
  return {
    osmId: l.osmId,
    name: l.name,
    category: l.category,
    address: l.address,
    phone: l.phone,
    website: l.website,
    email: l.email,
    lat: l.lat,
    lon: l.lon,
  };
}

export function Pipeline() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [listId, setListId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [newListOpen, setNewListOpen] = useState(false);
  const [outreach, setOutreach] = useState<OutreachTarget | null>(null);
  const [rechecking, setRechecking] = useState<Set<number>>(new Set());

  const loadLists = useCallback(() => {
    api<{ lists: ListSummary[] }>("/api/lists")
      .then((d) => setLists(d.lists))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadLists();
    api<{ leads: Lead[] }>("/api/leads")
      .then((d) => setLeads(d.leads))
      .catch((err: Error) => {
        toast.error(err.message);
        setLeads([]);
      });
  }, [loadLists]);

  const inList = useMemo(
    () => (leads ?? []).filter((l) => listId === null || l.listId === listId),
    [leads, listId],
  );

  const counts = useMemo(() => {
    const c: Record<LeadStatus | "all", number> = { all: inList.length, new: 0, contacted: 0, replied: 0, won: 0, lost: 0 };
    for (const l of inList) c[l.status]++;
    return c;
  }, [inList]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inList.filter(
      (l) =>
        (status === "all" || l.status === status) &&
        (!q || [l.name, l.category, l.address, l.email, l.notes].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [inList, status, query]);

  function patchLocal(id: number, patch: Partial<Lead>) {
    setLeads((prev) => prev?.map((l) => (l.id === id ? { ...l, ...patch } : l)) ?? null);
  }

  async function update(id: number, patch: Partial<Pick<Lead, "status" | "notes" | "listId">>) {
    const before = leads?.find((l) => l.id === id);
    patchLocal(id, patch);
    try {
      await api("/api/leads", { method: "PATCH", json: { id, ...patch } });
      if ("listId" in patch) loadLists();
    } catch (err) {
      if (before) patchLocal(id, before);
      toast.error((err as Error).message);
    }
  }

  async function remove(lead: Lead) {
    setLeads((prev) => prev?.filter((l) => l.id !== lead.id) ?? null);
    try {
      await api(`/api/leads?id=${lead.id}`, { method: "DELETE" });
      toast.success(`Removed ${lead.name}`);
      loadLists();
    } catch (err) {
      setLeads((prev) => (prev ? [...prev, lead] : prev));
      toast.error((err as Error).message);
    }
  }

  async function recheck(lead: Lead) {
    setRechecking((s) => new Set(s).add(lead.id));
    try {
      const res = await api<{ signals: Signals; score: number; email: string | null; phone: string | null }>(
        "/api/enrich",
        { method: "POST", json: { business: toBusiness(lead), leadId: lead.id } },
      );
      patchLocal(lead.id, { signals: res.signals, score: res.score, email: res.email, phone: res.phone });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRechecking((s) => {
        const n = new Set(s);
        n.delete(lead.id);
        return n;
      });
    }
  }

  async function deleteList(id: number) {
    try {
      await api(`/api/lists?id=${id}`, { method: "DELETE" });
      setLists((prev) => prev.filter((l) => l.id !== id));
      setLeads((prev) => prev?.map((l) => (l.listId === id ? { ...l, listId: null } : l)) ?? null);
      setListId(null);
      toast.success("List deleted. Its leads are kept.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const exportHref = `/api/export?${new URLSearchParams({
    ...(status !== "all" && { status }),
    ...(listId !== null && { listId: String(listId) }),
  })}`;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every lead you&apos;ve saved, from first look to won.</p>
        </div>
        <a
          href={exportHref}
          className="inline-flex h-10 items-center gap-2 self-start rounded-lg border bg-card px-3 text-sm font-medium transition hover:bg-accent sm:self-auto"
        >
          <DownloadIcon className="size-4" /> Export CSV
        </a>
      </div>

      {/* Status strip doubles as the filter */}
      <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-6">
        {(["all", ...LEAD_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={cn(
              "flex min-h-16 flex-col items-start justify-between gap-1 bg-card p-3 text-left transition-colors hover:bg-accent",
              status === s && "bg-secondary shadow-[inset_0_-2px_0_var(--forge)]",
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {s !== "all" && <span className={cn("size-1.5 rounded-full", STATUS_DOT[s])} />}
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </span>
            <span className="font-data text-xl font-semibold leading-none">{counts[s]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Filter by list"
          value={listId ?? ""}
          onChange={(e) => setListId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border bg-card px-2 text-sm"
        >
          <option value="">All lists</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.leadCount ?? 0})
            </option>
          ))}
        </select>
        <Button variant="outline" className="h-10 gap-1" onClick={() => setNewListOpen(true)}>
          <PlusIcon /> List
        </Button>
        {listId !== null && (
          <Button variant="ghost" className="h-10 gap-1 text-muted-foreground" onClick={() => deleteList(listId)}>
            <Trash2Icon /> Delete list
          </Button>
        )}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, email, notes…"
          className="h-10 w-full rounded-md border bg-card px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:ml-auto sm:w-72 sm:text-sm"
        />
      </div>

      {leads === null ? (
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="grid-paper mb-6 size-20 rounded-2xl border" />
          <h2 className="text-xl font-bold">No saved leads yet.</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Run a search, check the websites, and save the ones worth a message.
          </p>
          <Link
            href="/search"
            className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Find leads
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid gap-2">
          {visible.map((l) => (
            <li
              key={l.id}
              className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[5rem_minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1.8fr)_auto] lg:items-start"
            >
              <ScoreBadge score={l.score} pending={rechecking.has(l.id)} />

              <div className="min-w-0">
                <p className="font-semibold leading-snug">{l.name}</p>
                <p className="mt-0.5 font-data text-xs text-muted-foreground">{l.category}</p>
                {l.address && <p className="mt-0.5 truncate text-xs text-muted-foreground">{l.address}</p>}
                <div className="mt-2">
                  <SignalChips website={l.website} signals={l.signals} />
                </div>
              </div>

              <div className="grid min-w-0 gap-1">
                {l.phone && (
                  <a href={`tel:${l.phone}`} className="flex items-center gap-1.5 font-data text-xs hover:text-forge">
                    <PhoneIcon className="size-3 text-muted-foreground" /> {l.phone}
                  </a>
                )}
                {l.email && (
                  <a href={gmailComposeUrl(l.email)} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 font-data text-xs hover:text-forge">
                    <MailIcon className="size-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{l.email}</span>
                  </a>
                )}
                {l.website && (
                  <a
                    href={l.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-center gap-1.5 font-data text-xs text-muted-foreground hover:text-forge"
                  >
                    <ExternalLinkIcon className="size-3 shrink-0" />
                    <span className="truncate">{hostOf(l.website)}</span>
                  </a>
                )}
                <a
                  href={googleProfileUrl(l.name, l.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-data text-xs text-muted-foreground hover:text-forge"
                >
                  <MapPinIcon className="size-3 shrink-0" /> Google profile
                </a>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    aria-label={`Status for ${l.name}`}
                    value={l.status}
                    onChange={(e) => update(l.id, { status: e.target.value as LeadStatus })}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`List for ${l.name}`}
                    value={l.listId ?? ""}
                    onChange={(e) => update(l.id, { listId: e.target.value ? Number(e.target.value) : null })}
                    className="h-9 max-w-40 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">No list</option>
                    {lists.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <NotesField
                key={`${l.id}-${l.updatedAt}`}
                initial={l.notes ?? ""}
                onSave={(notes) => update(l.id, { notes: notes || null })}
              />

              <div className="flex flex-wrap gap-1.5 lg:flex-col lg:items-stretch">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1 lg:h-8"
                  onClick={() =>
                    setOutreach({ business: toBusiness(l), signals: l.signals, leadId: l.id, existing: l.outreach })
                  }
                >
                  <SparklesIcon /> {l.outreach ? "View email" : "Email"}
                </Button>
                {l.website && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1 lg:h-8"
                    onClick={() => recheck(l)}
                    disabled={rechecking.has(l.id)}
                  >
                    <RadarIcon /> {l.signals ? "Re-check" : "Check"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1 text-muted-foreground hover:text-destructive lg:h-8"
                  onClick={() => remove(l)}
                >
                  <Trash2Icon /> Remove
                </Button>
              </div>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="py-10 text-center text-sm text-muted-foreground">Nothing matches these filters.</li>
          )}
        </ul>
      )}

      <NewListDialog
        open={newListOpen}
        onOpenChange={setNewListOpen}
        onCreated={(l) => {
          setLists((prev) => [...prev, { ...l, leadCount: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
          setListId(l.id);
        }}
      />
      <OutreachDialog
        target={outreach}
        onClose={() => setOutreach(null)}
        onSaved={(draft) => outreach?.leadId && patchLocal(outreach.leadId, { outreach: draft })}
      />
    </div>
  );
}

function NotesField({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">Notes</span>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== initial && onSave(value)}
        rows={3}
        placeholder="Called Tue, ask for the office manager…"
        className="min-h-20 resize-y rounded-md border bg-background px-2.5 py-2 text-base leading-snug outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:text-sm"
      />
    </label>
  );
}
