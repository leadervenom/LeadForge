import type { Business } from "@/lib/types";

export const USER_AGENT = "LeadForge/1.0 (+https://github.com/leadervenom/LeadForge)";

// The public servers are often busy (429/504), so we try several in turn.
const OVERPASS_ENDPOINTS = [
  "https://z.overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** Niche keyword → Overpass tag filters. Keys are matched against the singularised query. */
export const NICHES: Record<string, string[]> = {
  dentist: ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  doctor: ['["amenity"="doctors"]', '["healthcare"="doctor"]'],
  clinic: ['["amenity"="clinic"]'],
  chiropractor: ['["healthcare"="chiropractor"]', '["healthcare:speciality"="chiropractic"]'],
  physiotherapist: ['["healthcare"="physiotherapist"]'],
  optician: ['["shop"="optician"]', '["healthcare"="optometrist"]'],
  pharmacy: ['["amenity"="pharmacy"]'],
  veterinarian: ['["amenity"="veterinary"]'],
  vet: ['["amenity"="veterinary"]'],
  restaurant: ['["amenity"="restaurant"]'],
  cafe: ['["amenity"="cafe"]'],
  coffee: ['["amenity"="cafe"]'],
  bar: ['["amenity"="bar"]', '["amenity"="pub"]'],
  bakery: ['["shop"="bakery"]'],
  "hair salon": ['["shop"="hairdresser"]'],
  salon: ['["shop"="hairdresser"]', '["shop"="beauty"]'],
  hairdresser: ['["shop"="hairdresser"]'],
  barber: ['["shop"="hairdresser"]["hairdresser"="barber"]', '["shop"="barber"]', '["shop"]["name"~"barber",i]'],
  "beauty salon": ['["shop"="beauty"]'],
  spa: ['["leisure"="spa"]', '["shop"="beauty"]["beauty"="spa"]'],
  "nail salon": ['["shop"="beauty"]["beauty"="nails"]', '["shop"]["name"~"nail",i]'],
  gym: ['["leisure"="fitness_centre"]'],
  fitness: ['["leisure"="fitness_centre"]'],
  yoga: ['["sport"="yoga"]', '["leisure"="fitness_centre"]["name"~"yoga",i]'],
  plumber: ['["craft"="plumber"]'],
  electrician: ['["craft"="electrician"]'],
  roofer: ['["craft"="roofer"]'],
  carpenter: ['["craft"="carpenter"]'],
  painter: ['["craft"="painter"]'],
  hvac: ['["craft"="hvac"]', '["craft"="heating_engineer"]'],
  landscaper: ['["craft"="gardener"]', '["shop"="garden_centre"]'],
  contractor: ['["craft"="builder"]', '["office"="construction_company"]'],
  "auto repair": ['["shop"="car_repair"]'],
  mechanic: ['["shop"="car_repair"]'],
  "car dealer": ['["shop"="car"]'],
  "car wash": ['["amenity"="car_wash"]'],
  lawyer: ['["office"="lawyer"]'],
  attorney: ['["office"="lawyer"]'],
  accountant: ['["office"="accountant"]', '["office"="tax_advisor"]'],
  "real estate": ['["office"="estate_agent"]'],
  realtor: ['["office"="estate_agent"]'],
  insurance: ['["office"="insurance"]'],
  hotel: ['["tourism"="hotel"]', '["tourism"="motel"]', '["tourism"="guest_house"]'],
  florist: ['["shop"="florist"]'],
  "pet store": ['["shop"="pet"]'],
  "pet grooming": ['["shop"="pet_grooming"]'],
  jeweler: ['["shop"="jewelry"]'],
  "clothing store": ['["shop"="clothes"]'],
  "furniture store": ['["shop"="furniture"]'],
  "hardware store": ['["shop"="hardware"]', '["shop"="doityourself"]'],
  tattoo: ['["shop"="tattoo"]'],
  photographer: ['["craft"="photographer"]', '["shop"="photo"]'],
  "dry cleaner": ['["shop"="dry_cleaning"]', '["shop"="laundry"]'],
  daycare: ['["amenity"="childcare"]', '["amenity"="kindergarten"]'],
  school: ['["amenity"="language_school"]', '["amenity"="driving_school"]', '["amenity"="music_school"]'],
};

function singular(word: string) {
  const w = word.trim().toLowerCase();
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (/(ss|sh|ch|x)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&");
}

/** Resolve a free-text niche to Overpass filters. Unknown niches fall back to name / tag-value matching. */
export function nicheFilters(niche: string): { filters: string[]; matched: string | null } {
  const q = niche.trim().toLowerCase();
  const candidates = [q, singular(q), q.split(/\s+/).map(singular).join(" ")];
  for (const c of candidates) {
    if (NICHES[c]) return { filters: NICHES[c], matched: c };
  }
  for (const key of Object.keys(NICHES)) {
    if (candidates.some((c) => new RegExp(`\\b${escapeRegex(key)}\\b`).test(c))) {
      return { filters: NICHES[key], matched: key };
    }
  }
  const re = escapeRegex(singular(q));
  return {
    filters: [
      `["name"~"${re}",i]`,
      `["shop"~"${re}",i]`,
      `["craft"~"${re}",i]`,
      `["office"~"${re}",i]`,
      `["amenity"~"${re}",i]`,
    ],
    matched: null,
  };
}

/** Split "dentists in Austin, TX" into niche + location. */
export function parseQuery(q: string): { niche: string; location: string } | null {
  const m = q.match(/^\s*(.+?)\s+(?:in|near|around|at)\s+(.+?)\s*$/i);
  if (!m) return null;
  return { niche: m[1], location: m[2] };
}

export interface Place {
  lat: number;
  lon: number;
  displayName: string;
}

export async function geocode(location: string): Promise<Place | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", location);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!data.length) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon), displayName: data[0].display_name };
}

/** Bounding-box queries are much cheaper for Overpass than `around:` radius filters. */
export function buildOverpassQuery(filters: string[], place: Place, radiusMeters: number, limit: number) {
  const dLat = radiusMeters / 111_320;
  const dLon = radiusMeters / (111_320 * Math.cos((place.lat * Math.PI) / 180));
  const bbox = [place.lat - dLat, place.lon - dLon, place.lat + dLat, place.lon + dLon]
    .map((n) => n.toFixed(5))
    .join(",");
  const parts = filters.map((f) => `  nwr${f}["name"];`).join("\n");
  return `[out:json][timeout:20][bbox:${bbox}];\n(\n${parts}\n);\nout center tags ${limit};`;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function runOverpass(query: string): Promise<OverpassElement[]> {
  let lastError: unknown = null;
  const deadline = Date.now() + 50_000;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    if (Date.now() > deadline) break;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(Math.min(25_000, deadline - Date.now())),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const data = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
      // A server-side timeout comes back as 200 with a "remark" and no elements
      if (data.remark && /timed out|out of memory/i.test(data.remark)) throw new Error(data.remark);
      return data.elements ?? [];
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`All Overpass endpoints failed: ${String(lastError)}`);
}

function normalizeUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let u = raw.trim().split(/[;\s]/)[0];
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  try {
    return new URL(u).toString();
  } catch {
    return null;
  }
}

function categoryOf(tags: Record<string, string>): string | null {
  for (const key of ["amenity", "shop", "craft", "office", "healthcare", "leisure", "tourism"]) {
    if (tags[key] && tags[key] !== "yes") return tags[key].replace(/_/g, " ");
  }
  return null;
}

function addressOf(tags: Record<string, string>): string | null {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const cityLine = [tags["addr:city"], tags["addr:state"], tags["addr:postcode"]].filter(Boolean).join(", ");
  const full = [street, cityLine].filter(Boolean).join(", ");
  return full || tags["addr:full"] || null;
}

export function normalize(el: OverpassElement): Business | null {
  const tags = el.tags ?? {};
  if (!tags.name) return null;
  return {
    osmId: `${el.type}/${el.id}`,
    name: tags.name,
    category: categoryOf(tags),
    address: addressOf(tags),
    phone: tags.phone || tags["contact:phone"] || null,
    website: normalizeUrl(tags.website || tags["contact:website"] || tags.url),
    email: tags.email || tags["contact:email"] || null,
    lat: el.lat ?? el.center?.lat ?? null,
    lon: el.lon ?? el.center?.lon ?? null,
  };
}

export async function searchBusinesses(opts: {
  niche: string;
  location: string;
  radiusKm?: number;
  limit?: number;
}) {
  const place = await geocode(opts.location);
  if (!place) return { place: null, matched: null, businesses: [] as Business[] };
  const { filters, matched } = nicheFilters(opts.niche);
  const query = buildOverpassQuery(filters, place, (opts.radiusKm ?? 10) * 1000, opts.limit ?? 200);
  const elements = await runOverpass(query);

  const seen = new Set<string>();
  const businesses: Business[] = [];
  for (const el of elements) {
    const b = normalize(el);
    if (!b) continue;
    const key = `${b.name.toLowerCase()}|${b.address ?? ""}`;
    if (seen.has(key) || seen.has(b.osmId)) continue;
    seen.add(key);
    seen.add(b.osmId);
    businesses.push(b);
  }
  return { place, matched, businesses };
}
