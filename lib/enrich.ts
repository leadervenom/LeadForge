import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import { USER_AGENT } from "@/lib/osm";
import type { Signals } from "@/lib/types";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 5;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const JUNK_EMAIL = /\.(png|jpe?g|gif|svg|webp|css|js)$|example\.|sentry|wixpress|godaddy|domain\.com|yourdomain|email\.com|@2x/i;

const SOCIALS: Record<string, RegExp> = {
  facebook: /facebook\.com\//i,
  instagram: /instagram\.com\//i,
  linkedin: /linkedin\.com\//i,
  x: /(?:twitter|x)\.com\//i,
  youtube: /youtube\.com\//i,
  tiktok: /tiktok\.com\//i,
  yelp: /yelp\.com\/biz/i,
};

const BUILDERS: [string, RegExp][] = [
  ["WordPress", /wp-content|wp-includes/i],
  ["Wix", /wix\.com|wixstatic|_wixCssImports/i],
  ["Squarespace", /squarespace/i],
  ["Shopify", /cdn\.shopify|shopify\.com/i],
  ["Webflow", /webflow/i],
  ["GoDaddy", /godaddy|img1\.wsimg/i],
  ["Weebly", /weebly/i],
  ["Duda", /dudaone|multiscreensite/i],
];

function isPrivateIp(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/** Refuse to fetch anything that isn't a public http(s) host (SSRF guard). */
async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Unsupported port");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Blocked host");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("Blocked host");
}

async function safeFetch(input: string, signal: AbortSignal) {
  let url = new URL(input);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": `Mozilla/5.0 (compatible; ${USER_AGENT})`,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(loc, url);
      continue;
    }
    return { res, finalUrl: url };
  }
  throw new Error("Too many redirects");
}

async function readText(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function extractEmails($: cheerio.CheerioAPI, html: string) {
  const found = new Set<string>();
  $('a[href^="mailto:"]').each((_, el) => {
    const addr = decodeURIComponent(($(el).attr("href") ?? "").slice(7).split("?")[0]).trim();
    if (addr) found.add(addr.toLowerCase());
  });
  const text = $("body").text() + " " + html.slice(0, 400_000);
  for (const m of text.match(EMAIL_RE) ?? []) found.add(m.toLowerCase());
  return [...found].filter((e) => !JUNK_EMAIL.test(e)).slice(0, 5);
}

function extractPhones($: cheerio.CheerioAPI) {
  const found = new Set<string>();
  $('a[href^="tel:"]').each((_, el) => {
    const n = ($(el).attr("href") ?? "").slice(4).trim();
    if (n) found.add(n);
  });
  for (const m of $("body").text().match(PHONE_RE) ?? []) found.add(m.trim());
  return [...found].slice(0, 3);
}

function extractSocials($: cheerio.CheerioAPI) {
  const out: Record<string, string> = {};
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    for (const [name, re] of Object.entries(SOCIALS)) {
      if (!out[name] && re.test(href)) out[name] = href;
    }
  });
  return out;
}

function emptySignals(partial: Partial<Signals>): Signals {
  return {
    checkedAt: new Date().toISOString(),
    hasWebsite: false,
    reachable: false,
    https: false,
    mobileFriendly: false,
    title: null,
    description: null,
    emails: [],
    phones: [],
    socials: {},
    builder: null,
    loadMs: null,
    error: null,
    ...partial,
  };
}

async function fetchPage(url: string) {
  const started = Date.now();
  const { res, finalUrl } = await safeFetch(url, AbortSignal.timeout(FETCH_TIMEOUT_MS));
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (type && !type.includes("html")) throw new Error(`Not HTML (${type.split(";")[0]})`);
  const html = await readText(res);
  return { html, finalUrl, loadMs: Date.now() - started };
}

export async function enrichWebsite(website: string | null): Promise<Signals> {
  if (!website) return emptySignals({});

  let page: Awaited<ReturnType<typeof fetchPage>>;
  try {
    page = await fetchPage(website);
  } catch (err) {
    // Some sites only answer on https, so give it one more try
    if (website.startsWith("http://")) {
      try {
        page = await fetchPage(website.replace(/^http:/, "https:"));
      } catch {
        return emptySignals({ hasWebsite: true, error: errMessage(err) });
      }
    } else {
      return emptySignals({ hasWebsite: true, error: errMessage(err) });
    }
  }

  const $ = cheerio.load(page.html);
  let emails = extractEmails($, page.html);

  // No email on the homepage: try the most likely contact page
  if (!emails.length) {
    const contactHref = $("a[href]")
      .map((_, el) => $(el).attr("href"))
      .get()
      .find((h) => /contact/i.test(h));
    const contactUrl = contactHref ? new URL(contactHref, page.finalUrl) : new URL("/contact", page.finalUrl);
    if (contactUrl.hostname === page.finalUrl.hostname) {
      try {
        const contact = await fetchPage(contactUrl.toString());
        emails = extractEmails(cheerio.load(contact.html), contact.html);
      } catch {
        /* contact page is optional */
      }
    }
  }

  // Addresses on the site's own domain are the most likely to reach the business
  const siteDomain = page.finalUrl.hostname.replace(/^www\./, "");
  emails.sort((a, b) => Number(b.endsWith(`@${siteDomain}`)) - Number(a.endsWith(`@${siteDomain}`)));

  const builder = BUILDERS.find(([, re]) => re.test(page.html))?.[0] ?? null;

  return emptySignals({
    hasWebsite: true,
    reachable: true,
    https: page.finalUrl.protocol === "https:",
    mobileFriendly: $('meta[name="viewport"]').length > 0,
    title: $("title").first().text().trim().slice(0, 200) || null,
    description: $('meta[name="description"]').attr("content")?.trim().slice(0, 300) || null,
    emails,
    phones: extractPhones($),
    socials: extractSocials($),
    builder,
    loadMs: page.loadMs,
  });
}

function errMessage(err: unknown) {
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return "Timed out";
    return err.message.slice(0, 120);
  }
  return "Unknown error";
}
