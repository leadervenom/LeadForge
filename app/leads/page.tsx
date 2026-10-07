import type { Metadata } from "next";
import { Pipeline } from "./pipeline";

export const metadata: Metadata = { title: "Pipeline · LeadForge" };

export default function LeadsPage() {
  return <Pipeline />;
}
