"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/search", label: "Search" },
  { href: "/leads", label: "Pipeline" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="mr-auto flex items-center gap-2 font-heading text-lg font-bold tracking-tight">
          <Mark />
          LeadForge
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:h-9",
                pathname.startsWith(item.href) && "text-foreground underline decoration-forge decoration-2 underline-offset-[6px]",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          aria-label="Toggle dark mode"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:size-9"
        >
          <SunIcon className="hidden size-4 dark:block" />
          <MoonIcon className="size-4 dark:hidden" />
        </button>
      </div>
    </header>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="4" className="fill-foreground" />
      <path d="M7 16.5V7.5h3.2M7 12h2.6" className="stroke-background" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="15.5" cy="14" r="2.6" className="fill-forge" />
    </svg>
  );
}
