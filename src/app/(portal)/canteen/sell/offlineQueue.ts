"use client";
// Sales saved on this laptop while the internet was down (CT-15). Kept in the browser until they
// reach the database; each carries its own reference so sending it twice never records it twice.

export type QueuedSale = {
  clientRef: string;
  soldAt: string; // ISO time on the laptop when the sale was made
  lines: { item_id: string; qty: number; name: string }[];
  method: "cash" | "bkash";
  cashReceived: number | null;
  bkashRef: string | null;
  total: number;
  error?: string | null; // set when the database refused it (e.g. sold out); needs a person
};

const KEY = "tasveer-canteen-offline-sales";
export const QUEUE_EVENT = "canteen-offline-queue";

export function readQueue(): QueuedSale[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeQueue(q: QueuedSale[]) {
  try {
    if (q.length) window.localStorage.setItem(KEY, JSON.stringify(q));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the sale can't be kept, but there's nothing more we can do here.
  }
  try {
    window.dispatchEvent(new Event(QUEUE_EVENT));
  } catch {}
}

export function newRef(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** A thrown error (rather than an error message from the database) means the request never
 * got an answer: the internet or the server is unreachable. */
export function isNetworkFailure(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /fetch|network|load failed|failed to|connection|timed? ?out/i.test(msg) || e instanceof TypeError;
}
