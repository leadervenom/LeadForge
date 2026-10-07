import {
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { Signals } from "@/lib/types";

export const leadStatus = pgEnum("lead_status", [
  "new",
  "contacted",
  "replied",
  "won",
  "lost",
]);

export const lists = pgTable("lists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  listId: integer("list_id").references(() => lists.id, { onDelete: "set null" }),
  osmId: text("osm_id").notNull().unique(),
  name: text("name").notNull(),
  category: text("category"),
  address: text("address"),
  phone: text("phone"),
  website: text("website"),
  email: text("email"),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  signals: jsonb("signals").$type<Signals>(),
  score: integer("score"),
  status: leadStatus("status").default("new").notNull(),
  notes: text("notes"),
  outreach: text("outreach"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type LeadRow = typeof leads.$inferSelect;
export type ListRow = typeof lists.$inferSelect;
