import { CheckIcon, MinusIcon, XIcon } from "lucide-react";
import type { Signals, Tier } from "@/lib/types";
import { tierOf } from "@/lib/score";
import { cn } from "@/lib/utils";

const TIER_STYLE: Record<Tier, string> = {
  hot: "bg-hot text-white dark:text-background",
  warm: "bg-warm text-foreground dark:text-background",
  cold: "bg-cold/15 text-cold",
};

/** Score as a number plus a tier, with a small bar showing where it sits on 0–100. */
export function ScoreBadge({ score, pending }: { score: number | null | undefined; pending?: boolean }) {
  if (score === null || score === undefined) {
    return <span className="font-data text-xs text-muted-foreground">—</span>;
  }
  const tier = tierOf(score);
  return (
    <div className={cn("flex w-[4.5rem] flex-col gap-1", pending && "animate-pulse")}>
      <div className="flex items-baseline justify-between gap-1">
        <span className="font-data text-base font-semibold leading-none">{score}</span>
        <span className={cn("rounded px-1 py-px text-[10px] font-bold uppercase tracking-wider", TIER_STYLE[tier])}>
          {tier}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", tier === "hot" ? "bg-hot" : tier === "warm" ? "bg-warm" : "bg-cold")}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

type ChipState = "good" | "bad" | "unknown";

function Chip({ state, children }: { state: ChipState; children: React.ReactNode }) {
  const Icon = state === "good" ? CheckIcon : state === "bad" ? XIcon : MinusIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        state === "bad" && "border-forge/40 bg-forge/10 text-forge",
        state === "good" && "border-border text-muted-foreground",
        state === "unknown" && "border-dashed text-muted-foreground",
      )}
    >
      <Icon className="size-3" />
      {children}
    </span>
  );
}

/** Opportunity signals. Orange chips are the problems you can pitch on. */
export function SignalChips({ website, signals }: { website: string | null; signals?: Signals | null }) {
  if (!website) return <Chip state="bad">No website</Chip>;
  if (!signals) return <Chip state="unknown">Not checked yet</Chip>;
  if (!signals.reachable) {
    return (
      <span title={signals.error ?? undefined}>
        <Chip state="bad">Site down{signals.error ? ` · ${signals.error}` : ""}</Chip>
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      <Chip state={signals.https ? "good" : "bad"}>HTTPS</Chip>
      <Chip state={signals.mobileFriendly ? "good" : "bad"}>Mobile</Chip>
      <Chip state={signals.emails.length ? "good" : "bad"}>Email</Chip>
      {!signals.description && <Chip state="bad">No meta</Chip>}
      {signals.loadMs !== null && signals.loadMs > 3000 && <Chip state="bad">Slow</Chip>}
      {signals.builder && <Chip state="unknown">{signals.builder}</Chip>}
    </div>
  );
}

export function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
