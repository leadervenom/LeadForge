"use client";

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Run `worker` over `items` with at most `limit` in flight. */
export async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()!;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

const SENDER_KEY = "leadforge:sender";

export interface Sender {
  name: string;
  offer: string;
}

export function loadSender(): Sender {
  try {
    const raw = localStorage.getItem(SENDER_KEY);
    if (raw) return { name: "", offer: "", ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return { name: "", offer: "" };
}

export function saveSender(s: Sender) {
  try {
    localStorage.setItem(SENDER_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}
