"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightIcon, MapPinIcon, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchBox({
  defaultNiche = "",
  defaultLocation = "",
  size = "default",
  className,
}: {
  defaultNiche?: string;
  defaultLocation?: string;
  size?: "default" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const [niche, setNiche] = useState(defaultNiche);
  const [location, setLocation] = useState(defaultLocation);
  const lg = size === "lg";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!niche.trim() || !location.trim()) return;
    const qs = new URLSearchParams({ niche: niche.trim(), location: location.trim() });
    router.push(`/search?${qs}`);
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border bg-card p-2 shadow-[0_1px_0_0_var(--border),0_12px_32px_-16px_color-mix(in_oklch,var(--foreground)_25%,transparent)] sm:flex-row sm:items-center sm:gap-0",
        className,
      )}
    >
      <label className="flex flex-1 items-center gap-2 px-3">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Type of business</span>
        <input
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="Dentists, plumbers, cafés…"
          className={cn("h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground", lg && "sm:h-12 sm:text-lg")}
          required
        />
      </label>
      <div className="hidden h-7 w-px bg-border sm:block" />
      <label className="flex flex-1 items-center gap-2 border-t px-3 sm:border-t-0">
        <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Location</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Austin, TX"
          className={cn("h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground", lg && "sm:h-12 sm:text-lg")}
          required
        />
      </label>
      <button
        type="submit"
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:translate-y-px",
          lg && "sm:h-12 sm:px-6",
        )}
      >
        Find leads
        <ArrowRightIcon className="size-4" />
      </button>
    </form>
  );
}
