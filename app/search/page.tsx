import type { Metadata } from "next";
import { Suspense } from "react";
import { Results, ResultsSkeleton } from "./results";

export const metadata: Metadata = { title: "Search · LeadForge" };

export default function SearchPage() {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <Results />
    </Suspense>
  );
}
